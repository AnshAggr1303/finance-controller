"""
Phase 4 -- Two-pass batch runner.

Pass 1 (deterministic): every order runs ingestion -> router ->
entity_extraction -> matcher, claiming every match strict evidence
(ID reference or amount arithmetic) supports -- for the WHOLE batch --
before any LLM reasoning happens.

Pass 2 (LLM): only after pass 1 finishes for every order does Node 5
run, on whatever's left unresolved. This ordering closes a real race:
running Node 5 per-order, interleaved with Node 4, let an early
record's loose LLM guess claim a bank row that a later record's
exact/rounding-tolerance deterministic match should have gotten
instead. Two passes make that structurally impossible.

Run from inside backend/, with venv active:
    python -u -m app.graph.run_batch --batch-id <uuid>
"""

import argparse

from dateutil import parser as dtparser

from app.db import supabase
from app.graph.build import build_graph
from app.graph.nodes import exception_analyzer_node

graph = build_graph()

# true_match_id deliberately never in this list -- the agent must
# rediscover the match itself, never read the answer key.
ORDER_COLUMNS = "id, order_id, amount, currency, order_ts, customer_ref, batch_id"


def fetch_pending_orders(batch_id: str) -> list:
    orders = (
        supabase.table("raw_orders")
        .select(ORDER_COLUMNS)
        .eq("batch_id", batch_id)
        .execute()
        .data
    )
    already_processed = (
        supabase.table("reconciliation_state")
        .select("order_row_id")
        .eq("batch_id", batch_id)
        .execute()
        .data
    )
    processed_ids = {r["order_row_id"] for r in already_processed if r["order_row_id"]}
    return [o for o in orders if o["id"] not in processed_ids]


def run_pass1_for_order(order: dict, batch_id: str) -> dict:
    recon = (
        supabase.table("reconciliation_state")
        .insert({
            "batch_id": batch_id,
            "order_row_id": order["id"],
            "current_node": "ingestion",
            "status": "pending",
        })
        .execute()
    )
    reconciliation_id = recon.data[0]["id"]

    initial_state = {
        "batch_id": batch_id,
        "reconciliation_id": reconciliation_id,
        "order_row": order,
    }
    final_state = graph.invoke(initial_state)

    supabase.table("reconciliation_state").update({
        "current_node": final_state.get("current_node"),
        "status": final_state.get("status", "pending"),
    }).eq("id", reconciliation_id).execute()

    return final_state


def fetch_pass2_candidates(batch_id: str) -> list:
    """Records pass 1 couldn't resolve deterministically -- still pending."""
    return (
        supabase.table("reconciliation_state")
        .select("id, order_row_id")
        .eq("batch_id", batch_id)
        .eq("status", "pending")
        .execute()
        .data
    )


def run_pass2_for_record(rec: dict, batch_id: str) -> tuple:
    order = (
        supabase.table("raw_orders")
        .select("id, order_id, amount, currency, order_ts, customer_ref")
        .eq("id", rec["order_row_id"])
        .single()
        .execute()
        .data
    )
    ts = order.get("order_ts")
    if isinstance(ts, str):
        order["order_ts"] = dtparser.isoparse(ts)
    order["amount"] = round(float(order["amount"]), 2)

    state = {
        "batch_id": batch_id,
        "reconciliation_id": rec["id"],
        "order_row": order,
    }
    final_state = exception_analyzer_node(state)

    supabase.table("reconciliation_state").update({
        "current_node": final_state.get("current_node"),
        "status": final_state.get("status"),
    }).eq("id", rec["id"]).execute()

    return order["order_id"], final_state


def main(batch_id: str):
    orders = fetch_pending_orders(batch_id)
    print(f"Pass 1 (deterministic): {len(orders)} unprocessed orders", flush=True)
    for order in orders:
        final_state = run_pass1_for_order(order, batch_id)
        print(
            f"  {order['order_id']:<14} -> "
            f"node={final_state.get('current_node'):<20} "
            f"status={final_state.get('status')}",
            flush=True,
        )

    pending = fetch_pass2_candidates(batch_id)
    print(f"\nPass 2 (LLM): {len(pending)} record(s) need semantic analysis", flush=True)
    for rec in pending:
        order_id, final_state = run_pass2_for_record(rec, batch_id)
        print(
            f"  {order_id:<14} -> "
            f"node={final_state.get('current_node'):<20} "
            f"status={final_state.get('status')}",
            flush=True,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-id", required=True, help="UUID from the batches table")
    args = parser.parse_args()
    main(args.batch_id)