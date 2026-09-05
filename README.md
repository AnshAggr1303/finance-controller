# AI Finance Controller

**Hackathon Track 04: AI Finance Controller**

## Problem

Reconciling internal order ledgers against bank settlement statements is a
multi-source matching problem: amounts drift by gateway fees, settlements
arrive days late, narrations are inconsistent, and a meaningful share of
records genuinely have no match at all. A finance team needs an agent that
processes the full batch — not a hand-picked sample — reconciles what it can
resolve with measured, stated accuracy, and hands back an honest exception
list for the records it can't, rather than guessing and hiding the failure
rate.

## THE BAR

- ✅ **Throughput** — all 50 orders in a batch are processed, every run.
  No cherry-picking a favorable subset; `data/scoring.py` scores 100% of
  the batch every time.
- ✅ **Measured accuracy** — precision and recall are stated exactly, not
  as a bare "100% accuracy" headline. See [Results](#results) below for
  the precise phrasing and what it does and doesn't claim.
- ✅ **Honest exception list** — records the pipeline can't confidently
  resolve are routed to a human review queue with ranked candidates and
  reasoning, not silently guessed or dropped.

## Architecture

Five LangGraph nodes, deterministic-first:

1. **Ingestion** — normalizes timestamp/amount/currency on a raw order.
2. **Router** — dispatch node. Every fresh record proceeds to entity
   extraction.
3. **Entity Extraction** — regex-first; scans candidate bank rows'
   narration for an explicit order ID or Hinglish "X se" reference, the
   strongest evidence tier, checked before any arithmetic.
4. **Deterministic Matcher** — tiered amount check: exact, ~2% gateway
   fee (±0.1 percentage points), rounding (≤₹1). Claims bank rows via a
   live query against `reconciliation_state`, so claims survive a
   crashed/resumed run.
5. **Exception Analyzer (LLM, Gemini)** — only runs on records Node 4
   couldn't resolve. Auto-resolves above 0.75 confidence, else flags for
   human review with top-3 ranked candidates.

### Router, not Supervisor

Node 2 is a plain dispatch node, not a Supervisor-style agent loop that
makes dynamic LLM-driven routing decisions. Every fresh record's next step
is the same — entity extraction — so there's nothing for a Supervisor to
decide. The one other dispatch job, applying a human's review decision, is
deliberately **not** a graph re-invocation: `human_review.py` handles it as
a single direct function call, because parsing a response, applying it, and
writing the audit trail is a one-step dispatch-and-write, not a multi-stage
pipeline that benefits from graph machinery.

### Two passes, not one graph per order

`run_batch.py` runs Pass 1 (Nodes 1–4) for the **entire batch** before Pass
2 (Node 5) touches anything. Running the LLM node per-order, interleaved
with the deterministic matcher, previously let an early record's loose LLM
guess claim a bank row that a later record's exact/rounding-tolerance
deterministic match should have gotten instead — a real race condition.
Two passes make that structurally impossible. Full incident history (this
race, plus a separate silent-overwrite bug and its fix) is in
[`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

## Results

Batch `c89d0198-9d27-4264-969b-677afc5eba45` (label `demo-video-final`),
50 orders:

> **Precision: 100% (35/35 auto-resolved matches were correct)** ·
> **Recall: 100% (35/35 genuine matches were found)** · **15/50 orders
> (30%) were correctly NOT auto-resolved**, including deliberately
> adversarial test cases with near-matching amounts and coincidentally
> close timestamps designed to trigger false positives. Verified via a
> hidden `true_match_id` ground-truth column embedded at data-generation
> time, checked independently by `data/scoring.py` after the fact — never
> visible to the matching pipeline itself. Reproduced consistently across
> two independently generated batches (see
> [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)).

```
True  Positives (TP):   35   (correct match claimed)
False Positives (FP):    0   (wrong match claimed)
False Negatives (FN):    0   (missed a real match)
True  Negatives (TN):   15   (correctly not claimed)

Precision           : 1.0000   (35/35)
Recall              : 1.0000   (35/35)
F1 Score            : 1.0000

Exception rate      : 30.0%   (15/50 in queue)
```

## Tech stack

- **Backend**: Python, FastAPI, LangGraph
- **Database**: Supabase (Postgres + Row-Level Security)
- **LLM**: Google Gemini (`gemini-3.6-flash`), via `langchain-google-genai`
- **Frontend**: Next.js (App Router), Tailwind CSS, TypeScript
- **Data**: synthetic order/bank-statement generator with a hidden
  `true_match_id` ground-truth column for scoring

## Setup & run

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```bash
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_OWNER_USER_ID=<a-user-id-from-auth.users>
GOOGLE_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-3.6-flash
```

Apply the schema once, in the Supabase SQL Editor: [`db/schema.sql`](db/schema.sql).

Run the API:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:3000`; it proxies `/api/*` to the backend at
`127.0.0.1:8000` (see `frontend/next.config.ts`) — no frontend `.env` needed.

Create a batch either via `POST /batches` (the API generates and pushes a
dataset itself), or run `python data/generator.py` followed by
`python data/push_to_db.py --label <name>` to do it manually. Then trigger
reconciliation with `POST /batches/{id}/run`.

### A note on the Gemini key

The free tier is 20 requests/day per project. If the demo key has hit that
limit, Node 5 will fail with `RESOURCE_EXHAUSTED` and every unresolved
record will land in the exception queue instead of getting a real LLM
verdict — the pipeline stays correct (nothing gets a wrong answer), it just
can't auto-resolve anything past the deterministic matcher. Swap in a fresh
key or project via `GOOGLE_API_KEY` to restore full Node 5 behavior.

## Known limitations

- **Gemini free-tier quota**: 20 requests/day per project. Get a paid key
  before a live demo that needs more than a couple of batch runs.
- **`gemini-3.6-flash` ignores `temperature=0`** — Node 5's LLM reasoning
  is not fully deterministic run-to-run, even with temperature pinned.
