# AI Finance Controller — Project Status & Handoff

Read this before doing any further work. It captures decisions, verified
results, and known issues from the design/build process so far.

## What this project is

Hackathon "Track 04: AI Finance Controller" — multi-source reconciliation
between internal orders and bank settlement statements, on 50+ synthetic
records, with measured accuracy and an honest exception list (not
guessing). Stack: Python + FastAPI + LangGraph backend, Supabase (Postgres
+ RLS), Next.js + Tailwind dashboard (not yet built), Gemini API for LLM
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
assignment race condition, confirmed with ground truth (a real match was
stolen by an incorrect 2.28%-deduction LLM guess before the true owner
was ever processed). Two passes make this structurally impossible: by
the time Node 5 runs on anyone, every deterministic claim in the batch
has already settled.

### Human-in-the-loop — NOT implemented as a graph re-entry

`app/graph/human_review.py` is a standalone CLI script, not a LangGraph
re-invocation. Deliberate choice: the actual work (parse a human's
response, apply it, write the audit trail) is a single dispatch-and-write,
not a multi-step pipeline — wrapping it in graph machinery would be
ceremony without benefit, since review happens in an entirely separate
process run, not a live pause/resume within one execution.

Parses `yes`, `yes <note>`, a number `1-3` (vendor choice), and `no`/
`reject`. Has a defensive bounds check (never index blindly into the
candidate list) and gracefully handles the case where a chosen candidate
was already claimed elsewhere (unique DB constraint — see below).

## Database (Supabase)

6 tables: `batches`, `raw_orders`, `raw_bank_statements`,
`reconciliation_state`, `audit_trail`, `human_overrides`. Full RLS on
all tables, scoped through `batches.user_id`. `raw_orders` and
`raw_bank_statements` carry a hidden `true_match_id` ground-truth column
that the agent NEVER selects/reads — only the verification queries do.

`reconciliation_state` has a unique partial index:
```sql
create unique index uq_bank_row_claimed on reconciliation_state
  (batch_id, bank_row_id) where status = 'matched';
```
This makes double-claiming a bank row impossible at the DB level, not
just unlikely at the application level. It has already caught a real bug
live (a human-review confirmation that would have double-matched a row).

## Data generator (`data/generator.py`)

Builds 50 records across 4 explicit categories with a hidden
`true_match_id` answer key: clean match (20), noisy match (15 -- fee/
rounding/delay noise, ~50% also embed a real order-ID reference in
narration to exercise Node 3), deceptive non-match (10 -- close-but-
unrelated amounts, a genuine false-positive trap), clean non-match (5).

**Fixed bug:** originally, `timedelta(hours=N)` offsets left the source
timestamp's microsecond fingerprint intact on derived timestamps. This
let Gemini treat "identical microseconds" as a match signal -- pure
generator artifact, not real evidence. Fixed with `jittered_offset()`
that also randomizes seconds/microseconds.

## Verified results (ground-truth checked via SQL, not eyeballed)

On a clean batch after all fixes: **35/35 true positives** across
`deterministic_match` + `id_reference_match`, **0 false positives** in
the automated pipeline, **15/15 genuine non-matches correctly NOT
auto-resolved**. Node 5's `llm_match` auto-resolve path has been 0/0 or
correct in every properly-isolated test (the earlier 9-false-positive
incident was the timestamp-jitter bug, now fixed and reverified clean).

**Known, accepted limitation:** `gemini-3.6-flash` silently ignores
`temperature=0` ("uses fixed sampling defaults") -- Node 5 is NOT fully
deterministic run-to-run. The same record can get a different verdict on
different runs. This is model-level, not a code bug. Worth a line in the
README under known limitations.

**Known, accepted limitation:** free-tier Gemini quota is 20
requests/DAY per project (not per-minute) -- easy to exhaust during
iterative testing. `analyze_exception()` degrades gracefully (retries
with backoff, then conservatively flags for human review) rather than
crashing, and this has been proven under a real quota exhaustion.
Before any live/judged demo, get a paid key or verify a fresh project's
quota -- do not rely on free tier for the actual demo.

**Human-review UX finding (important, not yet fixed in code):** in a
live test, a human reviewer confirmed candidates by "closest amount"
without checking evidence quality, producing 11/11 wrong confirmations
on genuinely unmatched records -- mirroring exactly the failure mode the
Node 5 prompt was hardened against, but for humans instead of the LLM.
Proposed fix (not yet built): show the amount delta explicitly in the
CLI/dashboard, and warn when a delta doesn't match a known legitimate
pattern before accepting a human confirmation.

## What's built and verified vs. not yet started

**Built & verified:** schema + RLS + unique constraint, data generator
with controlled categories + ground truth, all 5 graph nodes, two-pass
orchestration, human review CLI, git repo with commit history.

**Not yet built:** FastAPI layer (everything currently runs via CLI
scripts, not an API), Next.js dashboard (nothing exists yet), a
formalized scoring script (precision/recall/F1 has been computed by hand
via SQL queries throughout development -- needs to become a real,
committed script/output, not just chat history), deployment (GitHub is
up; Hugging Face/Vercel have not happened), human-review UX hardening
(see above).

## Working conventions established so far

- Explain the "why" / design reasoning before writing code.
- Every claim of correctness gets verified against `true_match_id`
  ground truth via SQL -- never trust aggregate counts alone, always
  check individual pair correctness (a wrong result can hide inside a
  correct-looking total).
- Prefer editing/patching existing files over rewriting from scratch
  when the change is small.
- Commit at the end of each verified phase, with a message describing
  what changed AND what was verified.