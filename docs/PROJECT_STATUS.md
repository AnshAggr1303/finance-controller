# AI Finance Controller — Project Status & Handoff

Read this before doing any further work. It captures decisions, verified
results, and known issues from the design/build process so far.

## Re-trigger button wiring — RESOLVED and verified

Checked first: the interrupted session had left it completely untouched.
`OperationalHeader.tsx` had a single button commented `{/* Re-trigger /
Refresh Button */}` that only called the existing GET-based refresh —
`grep -rn "/run" frontend/src` returned zero matches, confirming
`POST /batches/{id}/run` was never wired up.

Fixed: added `runBatch()` to `lib/api.ts` (POST `/batches/{id}/run`),
split the combined button into two — a distinct "Re-trigger" button
(`disabled` + tooltip when `batchStatus === 'completed'`) and the
pre-existing "Refresh" (GET re-fetch), both in `OperationalHeader.tsx`.
`page.tsx` passes live `summary.status` down and handles the click via
`handleRetrigger`.

Verified live via gstack browse against the real running app (not the
Figma mockup): on the completed ground-truth batch
(`9c75a7ac-...`), the Re-trigger button rendered `[disabled]` in the
accessibility snapshot and a `click` attempt timed out with **zero**
`/run` network requests fired — the click is actually blocked, not just
grayed out. On a `running` batch (`9dbad857-...`), the button was
enabled and clicking it fired `POST /api/batches/9dbad857.../run`,
which completed and the dashboard re-fetched updated counts.

## Agent session note

This project previously had two agent sessions (a Gemini-based Antigravity
agent and Claude Code) potentially working on the same repo — a real
coordination risk. **Going forward, only Claude Code is being used.** No
special multi-agent check is needed anymore, but always run `git log`/
`git status` at the start of a session regardless, as general hygiene.

Two separate Gemini quotas exist in this project, do not confuse them:
(1) Antigravity's own agent subscription quota (unrelated to the project,
governs Antigravity's Gemini-powered agent feature itself), and (2) the
project's own Gemini API key used in `exception_analysis.py` for Node 5
(20 requests/day free tier). Only (2) matters for the actual application.

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
3. **Entity Extraction** — regex-first, scans candidate bank rows'
   narration for an explicit order ID or Hinglish "X se" reference —
   the STRONGEST evidence tier, checked before any arithmetic.
4. **Deterministic Matcher** — tiered amount check: exact, 2% gateway fee
   (±0.1 percentage points), rounding (≤₹1). Claims bank rows via a LIVE
   query against `reconciliation_state`.
5. **Exception Analyzer (LLM, Gemini)** — only runs on records Node 4
   couldn't resolve. Auto-resolves above 0.75 confidence, else flags for
   human review with top-3 ranked candidates.

### TWO PASSES, not one graph per order

`run_batch.py` runs Pass 1 (nodes 1-4) for the ENTIRE batch first, then
Pass 2 (Node 5) only after Pass 1 is fully done — fixes a real
greedy-assignment race condition (see git history).

### Human-in-the-loop — NOT a graph re-entry

`app/graph/human_review.py` is a standalone CLI script/shared logic
(also called from the API). Shows amount delta + pattern label per
candidate. Confirming an unknown-pattern candidate requires explicit
second confirmation. Thresholds imported from `matching.py`, not
duplicated.

## Silent-overwrite bug — RESOLVED and fully verified

A human's rejection was previously silently overwritten by a stray Pass-2
re-run. Fixed with conditional `.eq("status", <expected_prior_state>)`
guards on all 7 status-transition writes across `nodes.py`,
`run_batch.py`, `human_review.py`. Verified with real evidence: root
cause traced, live guard test showed a blocked write returns `.data ==
[]`, and a full 50-row ground-truth query on batch
`9c75a7ac-b6ca-41fc-84b2-714b5204b20c` showed 35/35 correct, 0 wrong, 15
genuine non-matches. This batch is the trusted basis for all frontend work.

## Database (Supabase)

6 tables: `batches`, `raw_orders`, `raw_bank_statements`,
`reconciliation_state`, `audit_trail`, `human_overrides`. Full RLS,
scoped through `batches.user_id`. `true_match_id` ground-truth column
NEVER selected by the agent — only verification/scoring code.

Unique partial index prevents double-claiming a bank row at the DB level:
```sql
create unique index uq_bank_row_claimed on reconciliation_state
  (batch_id, bank_row_id) where status = 'matched';
```

## Data generator (`data/generator.py`)

50 records, 4 categories, hidden `true_match_id` answer key. Timestamp-
jitter bug (fixed, see git history) previously let Gemini treat identical
microsecond fingerprints as false match signal.

## Scoring script (`data/scoring.py`) — built & verified

`--batch-id` → TP/FP/FN/TN + precision/recall/F1 against `true_match_id`.
Had a real bug (compared a bank row's own PK against a ground-truth
token instead of comparing both rows' tokens) — fixed, reverified 35/0/0/15.

## FastAPI layer (`backend/app/main.py`) — all 8 endpoints built & verified

`POST /batches`, `POST /batches/{id}/run`, `GET /batches/{id}/exceptions`,
`POST /batches/{id}/review/{reconciliation_id}`, `GET /batches` (list with
summary stats), `GET /batches/{id}/summary` (dashboard aggregates:
counts, settled amount, pipeline breakdown, recent audit trail),
`GET /batches/{id}/matches` (full matched-records list for the Matched
Records screen), `GET /batches/{id}/scorecard` (TP/FP/FN/TN + precision/
recall/F1 for the Scorecard screen, reusing `data/scoring.py`'s
classification directly). All
reuse existing verified logic rather than reimplementing it.

## Frontend (Next.js) — IN PROGRESS

Figma file: https://www.figma.com/design/SEHcktc0AI6wHVHAI6Eqhh/Untitled
5 screens: Dashboard (`1:6`), Batches List (`1:432`), Matched Records
(`1:826`), Exception Review Queue (`1:1670`), Scorecard (`1:1265`).
Design reviewed and corrected (no fabricated compliance claims, correct
0.75 threshold, correct ±0.1pp fee tolerance, realistic scale). Raw
Figma exports (code/screenshots) saved under `docs/figma/` as a working
reference — image asset URLs inside any raw export expire in ~7 days and
must never be used directly in shipped code; use `lucide-react` or
self-hosted SVGs instead.

**Built & verified (real screenshot + real API data against batch
`9c75a7ac-...`):**
- Shared layout shell (`Shell.tsx`, `Sidebar.tsx`, `TopBar.tsx`).
- Dashboard (`1:6`) — wired to `GET /batches/{id}/summary`. ₹ glyph
  issue fixed via Inter/JetBrains Mono fonts with tabular numerals.
  Verified: 50 orders, 35 matched (70%), 15 exceptions, ₹7,88,144.92
  settled, pipeline breakdown 27/8/0/15 matches API exactly.
- Batches List (`1:432`) — wired to `GET /batches`. Summary chips
  independently recomputed by hand from the real table and confirmed
  correct.
- Re-trigger button — wired to `POST /batches/{id}/run`, disabled with
  tooltip when `status === 'completed'`, separate from Refresh. See
  section above for verification evidence.
- Matched Records (`1:826`) — `recent_audit_trail` from `/summary` was
  NOT sufficient (capped at 20, mixes in exceptions), so added a
  dedicated `GET /batches/{id}/matches` querying reconciliation_state
  directly for every `status=matched` row. Figma's fabricated fields
  (GST numbers, merchant IDs, company names) do not exist in our
  schema and were not reproduced; the Exact/~2% Fee/Rounding/ID
  Reference/Gemini LLM filter chips ARE real, reusing
  `human_review.py`'s existing `_pattern_label`/`is_known_pattern`
  rather than a second classification. Verified: `data/scoring.py`
  35 TP/0 FP/0 FN, `/matches` independently returns 35 with a 23+2+2+8
  subtype breakdown summing to the already-verified 27/8 deterministic/
  id-reference split; live in-browser screenshot, filter/search/row-
  expansion all confirmed against real data with no console errors;
  both navigation entry points (Batches list, Dashboard's "View All
  Transactions" — previously dead-ended at `/batches`) land correctly.
- Exception Review Queue (`1:1670`) — wired to `GET /batches/{id}/
  exceptions` and `POST /batches/{id}/review/{id}`, reusing
  `human_review.py`'s `parse_human_response`/`apply_decision` exactly
  (no reimplementation). Added a real `flag_reason`/`flag_confidence`
  per exception from the actual Node 5 `audit_trail` row (not a
  fabricated score). Two-step confirm verified live: selecting an
  unknown-pattern candidate shows a warning with ZERO network requests
  until "Confirm Override & Match"; confirmed rows appear in
  `reconciliation_state`/`audit_trail`/`human_overrides` exactly as the
  CLI produces, checked via a direct Supabase query independent of this
  session's own endpoints. Reject path verified the same way. A
  known-pattern-no-warning candidate cannot occur naturally — confirmed
  empirically across all pre-existing batches (0/120+) and structurally
  (Node 4 already exhausts every known pattern against every unclaimed
  row before Node 5's wider 15-day window can produce one) — so that
  one path was verified against one disclosed synthetic candidate on a
  disposable probe batch, not the trusted batch. Trusted batch
  `9c75a7ac-...` was only ever read (final screenshot), never had a
  decision submitted against it; `data/scoring.py` reconfirmed
  35/0/0/15 unchanged afterward.

- Scorecard (`1:1265`) — wired to a new `GET /batches/{id}/scorecard`
  that imports `data.scoring`'s `fetch_recon_rows`/`compute_metrics`/
  `fetch_batch_label` directly and calls them as-is — no second
  TP/FP/FN/TN classification. `true_match_id` is read here on purpose
  (this endpoint IS the verification surface); every other endpoint
  still never selects it. Verified exact match: the endpoint's
  `tp=35 fp=0 fn=0 tn=15, precision=recall=f1=1.0` diffed identical
  against the CLI's own `python data/scoring.py --batch-id 9c75a7ac-...`
  output; live in-browser confirmed the same numbers render exactly
  (Precision/Recall/F1 all "100.00%", Exception Rate 30.00%), no
  console errors. Figma's fabricated per-row remediation/auditor detail
  was not reproduced — the Discrepancy Log shows real data only, and a
  clean "no discrepancies" state since this batch genuinely has none.

**Not yet built:** deployment.

## Verified results (ground-truth checked via SQL, never eyeballed)

Batch `9c75a7ac-b6ca-41fc-84b2-714b5204b20c`: 35/35 true positives, 0
false positives, 15/15 genuine non-matches correctly not auto-resolved.
This is the trusted batch for all frontend work.

**Known, accepted limitations:** `gemini-3.6-flash` ignores
`temperature=0` (Node 5 not fully deterministic run-to-run). Free-tier
Gemini quota is 20 requests/DAY per project — get a paid key before any
live demo. No `DELETE /batches/{id}` endpoint exists yet — cleaning up
a test/probe batch still means running `delete from batches where
id = ...` by hand (e.g. via the Supabase SQL Editor).

**Resolved:** that manual delete used to fail outright.
`human_overrides.resolved_order_row_id` and `resolved_bank_row_id` had
no delete action at all (Postgres default), so deleting a batch that
had ANY human-reviewed record hit a real FK violation on
`human_overrides_resolved_bank_row_id_fkey` and blocked the whole
cascade — confirmed live before the fix. Migrated both to `ON DELETE
SET NULL`, matching the pattern `reconciliation_state`'s equivalent
columns already used. Re-verified live on a fresh disposable batch
(not `9c75a7ac-...`) with a real human-override record: the single
`delete from batches where id = ...` now succeeds end-to-end with zero
manual cleanup, confirmed by zero rows remaining across all 6 tables
afterward. `data/scoring.py` on `9c75a7ac-...` reconfirmed untouched
(35 TP / 0 FP / 0 FN / 15 TN) both before and after.

`db/schema.sql` now exists, reconstructed from live introspection
(`pg_constraint`, `pg_indexes`, `pg_policies`, `pg_class`) rather than
memory — the schema had only ever been applied by hand through the
Supabase SQL Editor and was never committed before now.

## What's built and verified vs. not yet started

**Built & verified:** schema + RLS + unique constraint, data generator,
all 5 graph nodes, two-pass orchestration, human review CLI + API path
with pattern-warning hardening, scoring script, all 8 FastAPI endpoints
(added `GET /batches/{id}/matches` and `GET /batches/{id}/scorecard`),
Figma design (reviewed/corrected), shared layout shell, Dashboard
screen, Batches List screen, Re-trigger button wiring, Matched Records
screen, Exception Review Queue screen, Scorecard screen.

**Not yet built:** deployment.

All 5 planned screens are now built and verified against the trusted
batch `9c75a7ac-...`. Remaining work is deployment only.

## Working conventions established so far

- Explain the "why" / design reasoning before writing code.
- Every claim of correctness gets verified against `true_match_id`
  ground truth via SQL — internal consistency alone is NOT sufficient,
  it has looked correct while being wrong more than once in this project.
- A summary describing what was done and claiming it was verified is
  not itself verification — real command/query output must be shown.
- If a session is interrupted (quota, crash, disconnect) mid-task, treat
  that task's outcome as UNKNOWN, not "probably fine" or "probably not
  done" — check with git log/diff before continuing.
- For frontend/design tasks, pull real design context via Figma MCP
  tools directly, or from the saved exports in `docs/figma/` if MCP/
  browser tools are unavailable — never guess or work from memory.
- Prefer editing/patching existing files over rewriting from scratch.
- Commit at the end of each verified phase, describing what changed AND
  what was verified.