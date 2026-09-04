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

## ⚠️ OUTSTANDING — silent-overwrite bug: FIX CLAIMED, NOT YET VERIFIED

**What happened:** during testing, a human explicitly rejected 15
exception records. A later Pass-2 re-run (triggered by a still-unidentified
code path, possibly a manual retry for Gemini rate-limit failures) then
silently reverted 14 of those records' status back to `'exception'`,
discarding the human's verdict with no record that it happened. Found via
`audit_trail` timeline reconstruction, not code review — the aggregate
counts looked internally consistent right up until timestamps were
checked. That batch (`9a9877ca-ec35-49ec-8cf1-02245d3edc41`) is
corrupted; do not use it for anything.

**Claimed fix (commit `ee9d1e8`):** all 7 status-transition writes across
`nodes.py`, `run_batch.py`, `human_review.py` now use conditional
`.eq("status", <expected_prior_state>)` guards, so a write against a
record that already moved past its expected state becomes a no-op.

**Three things were asked for as verification and NONE were provided
before the session ended — this is the FIRST task in the new session:**

1. **Root cause still unknown.** What code path called
   `run_pass2_for_record` a second time on already-reviewed records,
   bypassing `fetch_pass2_candidates()`'s `status='pending'` filter?
   If that code path still exists, it may now be silently wasting Gemini
   quota hitting records it can no longer write to.
2. **No live guard test shown.** Need an actual attempted write against
   an already-resolved record using the real guarded update pattern, with
   the raw response shown — specifically whether `.data` comes back empty
   (blocked, correct) or contains the row (not actually guarded).
3. **No ground-truth check run on the new batch
   (`9c75a7ac-b6ca-41fc-84b2-714b5204b20c`, label
   "frontend-integration-test").** Only internal-consistency numbers were
   given (35 matched / 15 exception / 0 rejected / 50 audit rows, no
   duplicates) — NOT the same standard as everything else in this
   project. Run the real check before trusting this batch for anything:
   ```sql
   select ro.order_id, ro.true_match_id as ot, rbs.true_match_id as bt,
     case when ro.true_match_id = rbs.true_match_id then 'CORRECT' else 'WRONG' end as verdict
   from reconciliation_state rs
   join raw_orders ro on ro.id = rs.order_row_id
   left join raw_bank_statements rbs on rbs.id = rs.bank_row_id
   where rs.batch_id = '9c75a7ac-b6ca-41fc-84b2-714b5204b20c'
   order by verdict desc;
   ```

**Do not start frontend integration work until all three of the above
have real, shown output — not a summary claiming they pass.**

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

The **only** genuinely ground-truth-verified batch remains the earlier
one used throughout core development: 35/35 true positives across
`deterministic_match` + `id_reference_match`, 0 false positives, 15/15
genuine non-matches correctly not auto-resolved. The newer
`9c75a7ac-...` batch has NOT had this check run yet (see OUTSTANDING).

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

**Integration has not started.** No frontend code exists beyond the
default `create-next-app` scaffold. Build order once the OUTSTANDING
section above is resolved: (1) shared layout shell, (2) Dashboard,
(3) Batches List, (4) Matched Records, (5) Exception Review Queue —
preserve the two-step pattern-warning confirm exactly, real behavioral
logic not decoration, (6) Scorecard. One screen per task, verified
against a real running batch (screenshot showing real API data, not the
Figma mockup) before moving to the next.

## What's built and verified vs. not yet started

**Built & verified:** schema + RLS + unique constraint, data generator,
all 5 graph nodes, two-pass orchestration, human review CLI with
pattern-warning hardening, scoring script, all 6 FastAPI endpoints
(functionally present), Figma design (reviewed and corrected).

**Not yet verified (do first):** the silent-overwrite fix's root cause
and live guard test; ground-truth check on batch `9c75a7ac-...`.

**Not yet built:** all Next.js frontend code, deployment.

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