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
2. **Router** — dispatch node. Fresh records always → entity extraction.
3. **Entity Extraction** — regex-first. Scans candidate bank rows'
   narration for an explicit order ID (`ORD-\d+`) or a Hinglish "X se"
   customer-name reference — the STRONGEST evidence tier, checked before
   any arithmetic in the matcher.
4. **Deterministic Matcher** — tiered amount check: exact match, 2%
   gateway fee (±0.1 percentage points), rounding tolerance (≤₹1). Claims
   bank rows via a LIVE query against `reconciliation_state`.
5. **Exception Analyzer (LLM, Gemini)** — only runs on records Node 4
   couldn't resolve. Auto-resolves above a 0.75 confidence threshold,
   else flags for human review with the top-3 ranked candidates.

### Critical architecture decision: TWO PASSES, not one graph per order

`run_batch.py` runs Pass 1 (nodes 1-4) for the ENTIRE batch first, then
Pass 2 (Node 5) only after Pass 1 is fully done. Fixed a real greedy-
assignment race condition this way — see git history for the incident
(a real match was stolen by a bad LLM guess before the true owner was
processed) if full detail is ever needed.

### Human-in-the-loop — NOT a graph re-entry

`app/graph/human_review.py` is a standalone CLI script. Parses `yes`,
`yes <note>`, `1-3`, `no`/`reject`. Shows amount delta + pattern label
(`exact`/`~2% fee`/`rounding`/`⚠ unknown pattern`) per candidate.
Confirming an unknown-pattern candidate requires explicit
`confirm_unknown: true` (API) / a second `y/n` (CLI) — built after a live
test showed a human reviewer producing 11/11 wrong confirmations by
picking "closest amount" without checking evidence. Pattern thresholds
are imported from `matching.py`, not duplicated (verified 17/17 boundary
cases agree with `evaluate_match`).

## Silent-overwrite bug — FULLY VERIFIED (commit `ee9d1e8`, verification 2026-09-04)

**What happened:** during testing, a human explicitly rejected 15
exception records. A later Pass-2 re-run (triggered by a retry of
`POST /batches/{id}/run` while records were still `'pending'`) then
silently reverted 14 of those records' status back to `'exception'`,
discarding the human's verdict with no record that it happened. That
batch (`9a9877ca-ec35-49ec-8cf1-02245d3edc41`) is corrupted; do not
use it for anything.

**Root cause (now identified):** The `/run` endpoint is idempotent
in Pass 1 (skips already-processed orders) but was NOT idempotent in
Pass 2 — a second call to `POST /batches/{id}/run` on a batch where
human review had set records to `'rejected'` would call
`fetch_pass2_candidates()` (filters to `status='pending'`), get 0
candidates back, and be safe. BUT if the retry happened while some
records were still `'pending'` (e.g. Gemini rate-limit stall partway
through Pass 2), those `'pending'` records would be sent to
`run_pass2_for_record` a second time — overwriting any human decisions
that had been applied in the interim. That call path (`/run` called
twice while pending records exist) still exists and cannot be removed
without breaking the retry-after-quota-error workflow. It is now safe
because of the three-layer guard described below.

**Fix — three layers of defence (all verified live):**
1. `fetch_pass2_candidates()` filters `status='pending'` — records
   already at `exception`/`matched`/`rejected` are never selected.
2. `run_pass2_for_record()` pre-reads the record's current status and
   returns early if it is not `'pending'` (run_batch.py lines 96–108).
3. `exception_analyzer_node` (nodes.py) and all other write sites use
   `.eq("status", <expected_prior_state>)` on every `UPDATE` — so even
   if layers 1 and 2 are bypassed, the DB write is a no-op.

**Verified (2026-09-04) — real output, not a summary:**

*Guard test:* attempted `.update({"status":"exception"}).eq("id", …).eq("status","pending")` against record `4195ff38-ef6c-4031-904d-8849e1aeca80` which was already `status='matched'`. Raw response: `.data == []`. Record status remained `'matched'` after the attempt. Guard is working.

*Ground-truth check on batch `9c75a7ac-b6ca-41fc-84b2-714b5204b20c`:*
```
35 CORRECT | 0 WRONG | 15 NO_MATCH (genuine non-matches, no bank row assigned)
Total reconciliation_state rows: 50
```
All 35 matched records: ORDER `true_match_id` == BANK `true_match_id`. Zero false positives. Batch is clean and may be used for frontend integration.

## Database (Supabase)

6 tables: `batches`, `raw_orders`, `raw_bank_statements`,
`reconciliation_state`, `audit_trail`, `human_overrides`. Full RLS,
scoped through `batches.user_id`. `raw_orders`/`raw_bank_statements`
carry a hidden `true_match_id` ground-truth column the agent NEVER
selects/reads — only verification/scoring code does.

`reconciliation_state` has a unique partial index preventing double-
claiming a bank row at the DB level:
```sql
create unique index uq_bank_row_claimed on reconciliation_state
  (batch_id, bank_row_id) where status = 'matched';
```

## Data generator (`data/generator.py`)

50 records, 4 categories, hidden `true_match_id` answer key: clean match
(20), noisy match (15 — fee/rounding/delay, ~50% embed a real order-ID
reference), deceptive non-match (10 — false-positive trap), clean
non-match (5). Timestamp-jitter bug (fixed) is documented in git history
if needed.

## Scoring script (`data/scoring.py`) — built & verified

`--batch-id` → TP/FP/FN/TN + precision/recall/F1/exception rate against
`true_match_id`, writes `results/{batch_id}_scorecard.md`. Had a real bug
(compared a bank row's own PK against a ground-truth token instead of
comparing both rows' tokens — made every real match look like a false
positive) — fixed and reverified 35/0/0/15 matching prior hand-verification.

## FastAPI layer (`backend/app/main.py`) — all 6 endpoints exist

- `POST /batches`, `POST /batches/{id}/run`, `GET /batches/{id}/exceptions`,
  `POST /batches/{id}/review/{reconciliation_id}` — built earlier, verified
  end-to-end (fresh batch through the full API: 35/0/0/15, precision/recall 1.0).
- `GET /batches` (batch list with summary stats), `GET /batches/{id}/summary`
  (dashboard aggregates: counts, settled amount, pipeline breakdown,
  recent audit trail) — built this session. Functionally present, but see
  the OUTSTANDING section above — the batch used to demo `/summary`
  turned out to reveal the silent-overwrite bug, so treat the endpoint
  logic itself as provisionally fine but NOT yet exercised against a
  batch that's passed ground-truth verification.

All endpoints reuse existing verified logic (`push_to_db.clean_record`,
`parse_human_response`/`apply_decision`, `run_pass1_for_order`/
`run_pass2_for_record`) rather than reimplementing it.

## Verified results (ground-truth checked via SQL, never eyeballed)

The **original** development batch: 35/35 true positives across
`deterministic_match` + `id_reference_match`, 0 false positives, 15/15
genuine non-matches correctly not auto-resolved.

Batch `9c75a7ac-b6ca-41fc-84b2-714b5204b20c` ("frontend-integration-test"):
ground-truth verified 2026-09-04 — 35 CORRECT, 0 WRONG, 15 NO_MATCH.
Safe to use for frontend integration.

**Known, accepted limitations:** `gemini-3.6-flash` ignores
`temperature=0` (Node 5 not fully deterministic run-to-run). Free-tier
Gemini quota is 20 requests/DAY per project — get a paid key before any
live demo.

## Frontend design (Figma, from Stitch) — design finalized, integration NOT started

File: https://www.figma.com/design/SEHcktc0AI6wHVHAI6Eqhh/Untitled
5 screens: Dashboard (`1:6`), Batches List (`1:432`), Matched Records
(`1:826`), Exception Review Queue (`1:1670`), Scorecard (`1:1265`).

Design reviewed and corrected in one revision cycle: removed fabricated
compliance certifications (SOC-2/ISO27001/RBI — do NOT reintroduce),
fictional multi-gateway setup (system is ONE order source vs ONE bank
source), fabricated ML jargon, and unrealistic scale. Current version
has correct 0.75 threshold, correct ±0.1pp fee tolerance, realistic
order counts (~50/batch), accurate plain-language pipeline description.

**Known issues to fix DURING integration:**
- ₹ symbol renders as "Ø" in Figma's export — confirm real font supports
  the ₹ glyph in code.
- "Export Audit Pack" and "Skip for Later" buttons have no backend —
  disable/gray out, do not invent backend logic for them.

**Frontend integration in progress:**
- ✓ (1) Shared layout shell built & verified (left sidebar with Dashboard, Batches, Exception Review, Scorecard; top bar with active batch label, status badge, search, Run New Batch CTA).
- ✓ (2) Dashboard screen (`1:6`) built & verified against real running batch `9c75a7ac-b6ca-41fc-84b2-714b5204b20c` via `GET /batches/{id}/summary`. ₹ glyph font issue fixed (Inter & JetBrains Mono with tabular numerals). "Export" button disabled as specified.
- ✓ (3) Batches List screen (`1:432`) built & verified against real database records via `GET /batches`. Search, status filter, summary stats chips, active batch highlight, and "Inspect" jump to dashboard working.
- Next: (4) Matched Records (`1:826`), (5) Exception Review Queue (`1:1670`), (6) Scorecard (`1:1265`).

## What's built and verified vs. not yet started

**Built & verified:** schema + RLS + unique constraint, data generator,
all 5 graph nodes, two-pass orchestration, human review CLI with
pattern-warning hardening, scoring script, all 6 FastAPI endpoints,
Figma design (reviewed and corrected), shared layout shell, Dashboard screen (`1:6`), Batches List screen (`1:432`) verified against real database batches.

**Not yet built:** screens 4–6 (Matched Records, Exception Review Queue, Scorecard), deployment.

## Working conventions established so far

- Explain the "why" / design reasoning before writing code.
- Every claim of correctness gets verified against `true_match_id`
  ground truth via SQL — internal consistency (numbers that add up to
  each other) is NOT sufficient, it has looked correct while being wrong
  more than once this project. Always run the actual ground-truth query.
- A summary describing what was done and claiming it was verified is not
  itself verification — real command output must be shown for anything
  claimed as "done and verified."
- For frontend/design tasks, pull real design context directly via
  Figma's MCP tools, not a secondhand description.
- Prefer editing/patching existing files over rewriting from scratch for
  small changes.
- Commit at the end of each verified phase, with a message describing
  what changed AND what was verified.