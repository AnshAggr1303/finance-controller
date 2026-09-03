"""
Scoring script -- Phase 5.

Queries reconciliation_state joined to raw_orders / raw_bank_statements
using the true_match_id ground-truth column (which the agent NEVER reads)
to compute precision, recall, F1, and exception rate for a given batch.

Formalises the ad-hoc SQL verification queries used throughout development
(see docs/PROJECT_STATUS.md) into a committed, repeatable artefact.

The four quadrants:
  TP  -- agent claimed bank_row_id = X  AND  raw_orders.true_match_id = X
  FP  -- agent claimed bank_row_id = X  AND  raw_orders.true_match_id != X
          (or true_match_id is NULL but a claim was made)
  FN  -- agent left bank_row_id NULL    AND  raw_orders.true_match_id IS NOT NULL
  TN  -- agent left bank_row_id NULL    AND  raw_orders.true_match_id IS NULL

Exception rate = orders whose final status is 'exception' or 'pending'
                 (i.e. still in the human-review queue) / total orders.

Human-review confirmations are automatically captured because human_review.py
updates reconciliation_state in-place -- the same row we read here.

Run from the repo root (with backend venv active):
    python data/scoring.py --batch-id <uuid>
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_recon_rows(batch_id: str) -> list[dict]:
    """
    Pull every reconciliation_state row for the batch, enriched with:
      - raw_orders.true_match_id  (the correct answer the agent must never see)
      - raw_orders.order_id       (for human-readable output)

    The Supabase Python client's .select() with FK expansion uses PostgREST
    syntax: "foreign_table(col1, col2)".  raw_orders is referenced via the
    order_row_id FK.
    """
    rows = (
        supabase.table("reconciliation_state")
        .select(
            "id, order_row_id, bank_row_id, status, confidence, "
            "raw_orders!order_row_id(order_id, true_match_id), "
            "raw_bank_statements!bank_row_id(true_match_id)"
        )
        .eq("batch_id", batch_id)
        .execute()
        .data
    )
    return rows


def fetch_batch_label(batch_id: str) -> str:
    row = (
        supabase.table("batches")
        .select("label, created_at")
        .eq("id", batch_id)
        .single()
        .execute()
        .data
    )
    return row.get("label", ""), row.get("created_at", "")


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_row(row: dict) -> str:
    """
    Returns one of: 'TP', 'FP', 'FN', 'TN'.

    Correct comparison: both sides are the shared ground-truth UUID token
    that the generator stamps on a matched order+bank pair. They are NOT
    primary keys -- comparing bank_row_id (a PK) to true_match_id (a token)
    would never equal even for correct matches.

      TP -- agent claimed a bank row  AND  that bank row's true_match_id
            equals the order's true_match_id  (same shared token -> correct pair)
      FP -- agent claimed a bank row  AND  tokens differ (or order has no token)
      FN -- agent made no claim       AND  order has a true_match_id (missed it)
      TN -- agent made no claim       AND  order has no true_match_id (correct abstention)
    """
    order_info = row.get("raw_orders") or {}
    bank_info  = row.get("raw_bank_statements") or {}

    order_token: str | None = order_info.get("true_match_id")
    bank_token:  str | None = bank_info.get("true_match_id")   # None when no claim made
    claimed_bank_id: str | None = row.get("bank_row_id")

    if claimed_bank_id is not None:                     # agent made a claim
        if order_token is not None and order_token == bank_token:
            return "TP"                                  # tokens match -> correct pair
        else:
            return "FP"                                  # wrong bank row claimed
    else:                                               # agent did not claim
        if order_token is not None:
            return "FN"                                  # should have matched
        else:
            return "TN"                                  # correct abstention


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_metrics(rows: list[dict]) -> dict:
    counts = {"TP": 0, "FP": 0, "FN": 0, "TN": 0}
    exceptions = 0  # status in ('exception', 'pending')

    classified: list[tuple[str, str, str]] = []  # (order_id, classification, status)

    for row in rows:
        cls = classify_row(row)
        counts[cls] += 1

        order_info = row.get("raw_orders") or {}
        order_id = order_info.get("order_id", row["order_row_id"])
        status = row.get("status", "")
        classified.append((order_id, cls, status))

        if status in ("exception", "pending"):
            exceptions += 1

    total = len(rows)
    tp, fp, fn, tn = counts["TP"], counts["FP"], counts["FN"], counts["TN"]

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )
    exception_rate = exceptions / total if total > 0 else 0.0

    return {
        "total": total,
        "TP": tp, "FP": fp, "FN": fn, "TN": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "exception_rate": exception_rate,
        "exceptions": exceptions,
        "classified_rows": classified,
    }


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

SEPARATOR = "─" * 60


def print_summary(batch_id: str, label: str, m: dict) -> None:
    tp, fp, fn, tn = m["TP"], m["FP"], m["FN"], m["TN"]
    print()
    print(SEPARATOR)
    print(f"  SCORECARD — batch {batch_id}")
    if label:
        print(f"  Label : {label}")
    print(SEPARATOR)
    print(f"  Total orders        : {m['total']}")
    print()
    print(f"  True  Positives (TP): {tp:>4}   (correct match claimed)")
    print(f"  False Positives (FP): {fp:>4}   (wrong match claimed)")
    print(f"  False Negatives (FN): {fn:>4}   (missed a real match)")
    print(f"  True  Negatives (TN): {tn:>4}   (correctly not claimed)")
    print()
    print(f"  Precision           : {m['precision']:.4f}   ({tp}/{tp+fp})")
    print(f"  Recall              : {m['recall']:.4f}   ({tp}/{tp+fn})")
    print(f"  F1 Score            : {m['f1']:.4f}")
    print()
    print(f"  Exception rate      : {m['exception_rate']:.1%}   ({m['exceptions']}/{m['total']} in queue)")
    print(SEPARATOR)
    print()

    # Per-row detail for any non-TP/TN rows (the interesting cases)
    problems = [(oid, cls, st) for oid, cls, st in m["classified_rows"] if cls in ("FP", "FN")]
    if problems:
        print("  ⚠  Rows needing attention:")
        for order_id, cls, status in sorted(problems):
            print(f"     {order_id:<16}  {cls}  (status={status})")
        print()
    else:
        print("  ✓  No false positives or false negatives.\n")


def render_markdown(batch_id: str, label: str, created_at: str, m: dict) -> str:
    tp, fp, fn, tn = m["TP"], m["FP"], m["FN"], m["TN"]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    problems = [(oid, cls, st) for oid, cls, st in m["classified_rows"] if cls in ("FP", "FN")]
    problem_block = ""
    if problems:
        rows_md = "\n".join(
            f"| `{oid}` | **{cls}** | `{st}` |"
            for oid, cls, st in sorted(problems)
        )
        problem_block = f"""
## ⚠ Rows needing attention

| Order ID | Classification | Status |
|----------|---------------|--------|
{rows_md}
"""
    else:
        problem_block = "\n## ✓ No false positives or false negatives\n"

    all_rows_md = "\n".join(
        f"| `{oid}` | {cls} | `{st}` |"
        for oid, cls, st in sorted(m["classified_rows"])
    )

    return f"""# Scorecard — `{batch_id}`

| Field | Value |
|-------|-------|
| Batch label | {label or "—"} |
| Batch created | {created_at} |
| Scored at | {now} |

## Confusion matrix

| | Predicted Positive | Predicted Negative |
|---|---|---|
| **Actually Positive** | TP = {tp} | FN = {fn} |
| **Actually Negative** | FP = {fp} | TN = {tn} |

## Metrics

| Metric | Value | Detail |
|--------|-------|--------|
| Precision | **{m['precision']:.4f}** | {tp} / {tp + fp} |
| Recall | **{m['recall']:.4f}** | {tp} / {tp + fn} |
| F1 Score | **{m['f1']:.4f}** | |
| Exception rate | **{m['exception_rate']:.1%}** | {m['exceptions']} / {m['total']} in human queue |

## Interpretation

- **TP {tp}** — agent claimed the correct bank row ({tp}/{tp+fn} of all real matches).
- **FP {fp}** — agent claimed a bank row that was wrong or spurious.
- **FN {fn}** — agent left a real match unresolved.
- **TN {tn}** — agent correctly made no claim (genuine non-matches).
{problem_block}
## Per-order detail

| Order ID | Classification | Final Status |
|----------|---------------|-------------|
{all_rows_md}

---
*Generated by `data/scoring.py` using `true_match_id` ground truth.*
*The agent pipeline never reads `true_match_id` — this column is scoring-only.*
"""


def write_scorecard(batch_id: str, content: str) -> Path:
    out_dir = Path("results")
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"{batch_id}_scorecard.md"
    path.write_text(content, encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main(batch_id: str) -> None:
    print(f"Fetching reconciliation data for batch {batch_id} …", flush=True)

    rows = fetch_recon_rows(batch_id)
    if not rows:
        print(f"ERROR: No reconciliation_state rows found for batch {batch_id}.", file=sys.stderr)
        sys.exit(1)

    label, created_at = fetch_batch_label(batch_id)
    m = compute_metrics(rows)

    print_summary(batch_id, label, m)

    md = render_markdown(batch_id, label, created_at, m)
    path = write_scorecard(batch_id, md)
    print(f"Scorecard written to: {path.resolve()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Score a reconciliation batch against ground-truth true_match_id."
    )
    parser.add_argument(
        "--batch-id",
        required=True,
        help="UUID from the batches table (printed by push_to_db.py and run_batch.py)",
    )
    args = parser.parse_args()
    main(args.batch_id)
