"""
Phase 4 -- Graph skeleton runner.

Fetches every order in a batch that doesn't yet have a
reconciliation_state row, creates one, runs it through the graph,
and writes the resulting node/status back to Supabase.

Deliberately does NOT select true_match_id from raw_orders -- the
agent must rediscover the match itself, never read the answer key.

Run from the repo root:
    python -m app.graph.run_batch --batch-id <uuid>
(run from inside backend/, with venv active, since app/ is a package
 rooted at backend/)
"""

import argparse

from app.db import supabase
from app.graph.build import build_graph

graph = build_graph()

# Explicit column allowlist -- the whole point is that true_match_id
# is never in this list.
ORDER_COLUMNS = "id, order_id, amount, currency, order_ts, customer_ref, batch_id"


def fetch_pending_orders(batch_id: str) -> list[dict]:
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


def run_for_order(order: dict, batch_id: str) -> dict:
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


def main(batch_id: str):
    orders = fetch_pending_orders(batch_id)
    print(f"Found {len(orders)} unprocessed orders in batch {batch_id}")

    for order in orders:
        final_state = run_for_order(order, batch_id)
        print(
            f"  {order['order_id']:<14} -> "
            f"node={final_state.get('current_node'):<20} "
            f"status={final_state.get('status')}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-id", required=True, help="UUID from the batches table")
    args = parser.parse_args()
    main(args.batch_id)