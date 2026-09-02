"""
Phase 3 -- Push generated CSVs into Supabase as a new batch.

Reads data/output/orders.csv and data/output/bank_statements.csv,
creates one row in `batches`, then inserts everything into
raw_orders / raw_bank_statements tagged with that batch_id.

Uses the service_role key deliberately -- this script runs
server-side/offline, not from the frontend, so bypassing RLS here
is intentional and safe. Never ship this key to Next.js.

Run (after reviewing the CSVs):
    python data/push_to_db.py --label "first test batch"
"""

import argparse
import math
import os

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OWNER_USER_ID = os.environ["SUPABASE_OWNER_USER_ID"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def clean_record(record: dict) -> dict:
    """Replace pandas/numpy NaN floats with None so the payload is valid JSON.

    pandas' df.where(pd.notna(df), None) is unreliable here -- depending on
    column dtype it can silently leave NaN in place. Doing the swap
    explicitly at the dict level, after to_dict(), is deterministic.
    """
    return {
        k: (None if isinstance(v, float) and math.isnan(v) else v)
        for k, v in record.items()
    }


def push(label: str):
    orders_df = pd.read_csv("data/output/orders.csv")
    bank_df = pd.read_csv("data/output/bank_statements.csv")

    batch = supabase.table("batches").insert({
        "user_id": OWNER_USER_ID,
        "label": label,
    }).execute()
    batch_id = batch.data[0]["id"]
    print(f"Created batch {batch_id} ('{label}')")

    orders_df["batch_id"] = batch_id
    bank_df["batch_id"] = batch_id

    orders_records = [clean_record(r) for r in orders_df.to_dict("records")]
    bank_records = [clean_record(r) for r in bank_df.to_dict("records")]

    supabase.table("raw_orders").insert(orders_records).execute()
    supabase.table("raw_bank_statements").insert(bank_records).execute()

    print(f"Inserted {len(orders_records)} orders and {len(bank_records)} bank rows.")
    print(f"Batch ID (save this for scoring later): {batch_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="test batch", help="Human-readable label for this batch")
    args = parser.parse_args()
    push(args.label)