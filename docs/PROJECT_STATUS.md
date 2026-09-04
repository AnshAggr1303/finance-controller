# AI Finance Controller — Project Status & Handoff

Read this before doing any further work. It captures decisions, verified
results, and known issues from the design/build process so far.

## What this project is

Hackathon "Track 04: AI Finance Controller" — multi-source reconciliation
between internal orders and bank settlement statements, on 50+ synthetic
records, with measured accuracy and an honest exception list (not
guessing). Stack: Python + FastAPI + LangGraph backend, Supabase (Postgres
+ RLS), Next.js + Tailwind dashboard (in progress), Gemini API for LLM
reasoning.

## Architecture — 5 LangGraph nodes, deterministic-first

1. **Ingestion** — normalizes timestamp/amount/currency on a raw order.
2. **Router** — dispatch node. Currently only handles fresh records
   (always → entity extraction). Human-response dispatch does NOT run
   through this node — see "Human-in-the-loop" below for why.
3. **Entity Extraction** — regex-first. Scans candidate bank rows'
   narration for an explicit order ID (`ORD-\d+`) or a Hinglish "X se"
   customer-name reference. This is the STRONGEST evidence tier, checked
   before any arithmetic in the matcher.
4. **Deterministic Matcher** — tiered amount check: exact match, 2%
   gateway fee (±0.1 percentage points), rounding tolerance (≤₹1). Claims
   bank rows via a LIVE query against `reconciliation_state`, not an
   in-memory set — this is what makes claiming crash-safe and resumable.
5. **Exception Analyzer (LLM, Gemini)** — only runs on records Node 4
   couldn't resolve. Widens the candidate search window, asks Gemini for
   a structured verdict (is_match, confidence, reasoning). Auto-resolves
   above a 0.75 confidence threshold, else flags for human review with
   the top-3 ranked candidates stored for review.

### Critical architecture decision: TWO PASSES, not one graph per order

`run_batch.py` runs Pass 1 (nodes 1-4, deterministic) for the ENTIRE
batch first, then Pass 2 (Node 5, LLM) only after Pass 1 is fully done.

**Why this matters — a real bug we found and fixed:** running Node 5
inline per-order (interleaved with Node 4) let an early record's loose
LLM guess claim a bank row that a LATER record's exact/rounding-tolerance
deterministic match should have gotten instead — a genuine greedy-
assignment race condition, confirmed with ground truth. Two passes make
this structurally impossible.

### Human-in-the-loop — NOT implemented as a graph re-entry

`app/graph/human_review.py` is a standalone CLI script, not a LangGraph
re-invocation — the actual work (parse response, apply it, write the
audit trail) is a single dispatch-and-write, not a multi-step pipeline.

Parses `yes`, `yes <note>`, a number `1-3` (vendor choice), and `no`/
`reject`. Has a defensive bounds check and gracefully handles a chosen
candidate already being claimed elsewhere (unique DB constraint).

**Hardened (built & verified) since the original design:** the CLI (and
now the API, see below) shows the amount delta and a pattern label
(`exact` / `~2% fee` / `rounding` / `⚠ unknown pattern`) per candidate.
Confirming an "unknown pattern" candidate requires an explicit second
confirmation (`y/n` in the CLI, `confirm_unknown: true` in the API) —
this exists because a live test showed a human reviewer confirming
matches by "closest amount" without checking evidence, producing 11/11
wrong confirmations on genuinely unmatched records. The pattern-matching
logic (`is_known_pattern` in `human_review.py`) imports its thresholds
directly from `matching.py` (`FEE_PCT`, `ROUNDING_TOLERANCE`) rather than
duplicating them — verified to agree with `evaluate_match` on 17/17
boundary test cases.

## Database (Supabase)

6 tables: `batches`, `raw_orders`, `raw_bank_statements`,
`reconciliation_state`, `audit_trail`, `human_overrides`. Full RLS on
all tables, scoped through `batches.user_id`. `raw_orders` and
`raw_bank_statements` carry a hidden `true_match_id` ground-truth column
that the agent NEVER selects/reads — only verification/scoring code does.

`reconciliation_state` has a unique partial index preventing double-
claiming a bank row at the DB level:
```sql
create unique index uq_bank_row_claimed on reconciliation_state
  (batch_id, bank_row_id) where status = 'matched';
```

## Data generator (`data/generator.py`)

Builds 50 records across 4 explicit categories with a hidden
`true_match_id` answer key: clean match (20), noisy match (15 -- fee/
rounding/delay noise, ~50% embed a real order-ID reference in narration
to exercise Node 3), deceptive non-match (10 -- close-but-unrelated
amounts, a false-positive trap), clean non-match (5).

**Fixed bug:** `timedelta(hours=N)` offsets originally left the source
timestamp's microsecond fingerprint intact on derived timestamps, which
let Gemini treat "identical microseconds" as a match signal -- a pure
generator artifact. Fixed with `jittered_offset()`.

## Scoring script (`data/scoring.py`) -- built & verified

Takes `--batch-id`, computes TP/FP/FN/TN + precision/recall/F1/exception
rate against `true_match_id` ground truth, prints a summary, and writes
`results/{batch_id}_scorecard.md`.

**Real bug found and fixed during build:** `classify_row` originally
compared `reconciliation_state.bank_row_id` (the claimed bank row's own
database primary key) against `raw_orders.true_match_id` (the
generator's ground-truth linking token) -- two values in fundamentally
different namespaces that are never supposed to be equal, even for a
correct match. This made every real match register as a false positive
(TP=0, FP=35 on a batch already hand-verified as 35/0/0/15). Fixed by
adding an FK expansion to fetch the claimed bank row's own
`true_match_id` and comparing both rows' tokens against each other.
Reverified: TP=35, FP=0, FN=0, TN=15, matching prior hand-verification
exactly.

## FastAPI layer (`backend/app/main.py`) -- built & verified, COMPLETE

Reuses existing verified logic rather than reimplementing it:
`push_to_db.clean_record` for NaN handling, `parse_human_response` /
`apply_decision` from `human_review.py` for review submission,
`run_pass1_for_order` / `run_pass2_for_record` from `run_batch.py` for
orchestration.

**Endpoints that exist and are verified (all 6 needed endpoints):**
- `GET /batches` -- list all batches with label, order count, matched/exception/rejected/pending counts, match rate, and running/completed status
- `POST /batches` -- generate + push a new dataset
- `GET /batches/{id}/summary` -- aggregate counts (total orders, matched/exception/rejected/pending counts, match rate, status), total settled amount, pipeline-stage breakdown by decision_type from audit_trail, and 20 most recent audit_trail entries
- `POST /batches/{id}/run` -- two-pass reconciliation
- `GET /batches/{id}/exceptions` -- list pending review records with
  ranked candidates, delta, and pattern label per candidate
- `POST /batches/{id}/review/{reconciliation_id}` -- submit a human
  decision; returns a 400 with a clear message if `confirm_unknown` is
  needed but not set

Full end-to-end API test (fresh batch, create -> run -> exceptions ->
review -> scoring, entirely through the API): TP=35, FP=0, FN=0, TN=15,
precision/recall 1.0.


## Verified results (ground-truth checked via SQL, never eyeballed)

On a clean batch after all fixes: **35/35 true positives** across
`deterministic_match` + `id_reference_match`, **0 false positives**,
**15/15 genuine non-matches correctly NOT auto-resolved**.

**Known, accepted limitation:** `gemini-3.6-flash` silently ignores
`temperature=0` -- Node 5 is NOT fully deterministic run-to-run.

**Known, accepted limitation:** free-tier Gemini quota is 20
requests/DAY per project. `analyze_exception()` degrades gracefully
(retries, then flags for human review) rather than crashing -- proven
under a real quota exhaustion. Get a paid key before any live demo.

## Frontend design (Figma, from Stitch) -- design finalized, integration NOT started

File: https://www.figma.com/design/SEHcktc0AI6wHVHAI6Eqhh/Untitled
5 screens: Dashboard (`1:6`), Batches List (`1:432`), Matched Records
(`1:826`), Exception Review Queue (`1:1670`), Scorecard (`1:1265`).

Design went through one revision cycle. First version had fabricated
content that was caught and removed: fake compliance certifications
(SOC-2/ISO27001/RBI claims -- do NOT reintroduce anything like this),
a fictional multi-gateway setup (system is ONE order source vs ONE bank
source, not multiple bank integrations), fabricated ML jargon describing
the matching algorithm, and unrealistic scale (14,820 orders vs the
real ~50/batch). Current version is accurate: correct 0.75 confidence
threshold, correct ±0.1pp fee tolerance, realistic order counts, and an
accurate plain-language description of the real 5-node pipeline.

**Known issues to fix DURING integration, not in the Figma file itself:**
- ₹ symbol renders as "Ø" in Figma's export -- confirm the real font used
  in code actually supports the ₹ glyph.
- "Export Audit Pack" and "Skip for Later" buttons in the design have no
  backend behind them -- disable/gray them out, do not invent backend
  logic to make them functional.

**Integration has not started.** No frontend code exists beyond the
default `create-next-app` scaffold (`layout.tsx`, `page.tsx`,
`globals.css`). Build order: (1) the two missing backend endpoints above,
(2) a shared layout shell (sidebar nav + top bar, matching all 5
screens), (3) Dashboard, (4) Batches List, (5) Matched Records,
(6) Exception Review Queue -- preserve the two-step pattern-warning
confirm exactly, this is real behavioral logic, not decoration,
(7) Scorecard. One screen per task, verified against a real running
batch (screenshot showing real API data) before moving to the next.

## What's built and verified vs. not yet started

**Built & verified:** schema + RLS + unique constraint, data generator
with controlled categories + ground truth, all 5 graph nodes, two-pass
orchestration, human review CLI with pattern-warning hardening, scoring
script, FastAPI layer (all 6 needed endpoints), Figma design (5
screens, reviewed and corrected), git repo with commit history.

**Not yet built:** all Next.js frontend code, deployment (GitHub is up;
Hugging Face/Vercel have not happened).

## Working conventions established so far

- Explain the "why" / design reasoning before writing code.
- Every claim of correctness gets verified against `true_match_id`
  ground truth via SQL -- never trust aggregate counts alone, always
  check individual pair correctness.
- For frontend/design tasks, pull real context directly via Figma's MCP
  tools (screenshots, layer structure) rather than working from a
  secondhand description.
- Prefer editing/patching existing files over rewriting from scratch
  when the change is small.
- Commit at the end of each verified phase, with a message describing
  what changed AND what was verified.