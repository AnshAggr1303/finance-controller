"""
Phase 3 -- Synthetic data generator for the AI Finance Controller.

Builds two CSVs (orders.csv, bank_statements.csv) from four explicit
ground-truth categories, so every match/no-match answer is known in
advance and stored in a hidden `true_match_id` column. The agent never
sees this column -- only the scoring step does.

Fix: every derived bank_ts now jitters seconds/microseconds, not just
hours/days. Previously bank_ts = order_ts + timedelta(hours=N) left
the original microsecond fingerprint intact, which let a downstream
LLM mistake "identical microseconds" for a real match signal -- it's
purely a generator artifact, not a legitimate reconciliation cue.

Run:
    python data/generator.py
"""

import hashlib
import random
import uuid
from datetime import datetime, timedelta

import pandas as pd
from faker import Faker

fake = Faker("en_IN")
random.seed(42)  # reproducible while developing; change for the final demo run

# ---- Category config: tune these, they define your dataset's composition ----
CONFIG = {
    "clean_match": 20,        # exact match, no noise
    "noisy_match": 15,        # legit match, but fee / rounding / date drift
    "deceptive_nonmatch": 10, # unrelated, but deliberately close amounts/dates
    "clean_nonmatch": 5,      # unrelated, nothing in common
}

GATEWAY_FEE_PCT = 0.02  # 2% payment gateway fee


def record_hash(*parts) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def random_datetime_within(days_back=30):
    return datetime.now() - timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )


def jittered_offset(hours_min: int, hours_max: int, days: int = 0) -> timedelta:
    """A time offset that also jitters seconds/microseconds, so a
    derived timestamp never accidentally shares the source's exact
    sub-second fingerprint. Use this instead of a bare timedelta(...)
    whenever bank_ts is derived from order_ts.
    """
    return timedelta(
        days=days,
        hours=random.randint(hours_min, hours_max),
        seconds=random.randint(0, 3599),
        microseconds=random.randint(0, 999999),
    )


def make_order(amount, ts, true_match_id):
    order_id = f"ORD-{fake.unique.random_number(digits=6)}"
    row = {
        "order_id": order_id,
        "amount": round(amount, 2),
        "currency": "INR",
        "order_ts": ts.isoformat(),
        "customer_ref": fake.name(),
        "true_match_id": true_match_id,
    }
    row["record_hash"] = record_hash(order_id, row["amount"], row["order_ts"])
    return row


def make_bank_row(amount, ts, true_match_id, narration=None):
    txn_id = f"TXN-{fake.unique.random_number(digits=6)}"
    row = {
        "txn_id": txn_id,
        "amount": round(amount, 2),
        "currency": "INR",
        "settled_ts": ts.isoformat(),
        "narration": narration or fake.sentence(nb_words=4),
        "true_match_id": true_match_id,
    }
    row["record_hash"] = record_hash(txn_id, row["amount"], row["settled_ts"])
    return row


def generate():
    orders, bank_rows = [], []

    # --- Category 1: clean matches ---
    for _ in range(CONFIG["clean_match"]):
        match_id = str(uuid.uuid4())
        amount = round(random.uniform(500, 50000), 2)
        ts = random_datetime_within()
        orders.append(make_order(amount, ts, match_id))
        bank_rows.append(make_bank_row(amount, ts, match_id, narration="Settlement"))

    # --- Category 2: noisy but legitimate matches ---
    for _ in range(CONFIG["noisy_match"]):
        match_id = str(uuid.uuid4())
        order_amount = round(random.uniform(500, 50000), 2)
        order_ts = random_datetime_within()
        order_id = f"ORD-{fake.unique.random_number(digits=6)}"

        noise_type = random.choice(["fee", "rounding", "delay"])
        if noise_type == "fee":
            bank_amount = round(order_amount * (1 - GATEWAY_FEE_PCT), 2)
            bank_ts = order_ts + jittered_offset(1, 12)
            narration = "Settlement after gateway fee"
        elif noise_type == "rounding":
            bank_amount = round(order_amount + random.choice([-0.5, -0.1, 0.1, 0.5]), 2)
            bank_ts = order_ts + jittered_offset(1, 6)
            narration = "Settlement"
        else:  # delay
            bank_amount = order_amount
            bank_ts = order_ts + jittered_offset(0, 23, days=random.randint(1, 3))
            narration = "Delayed settlement"

        # ~50% of the time, embed a real order ID reference in the
        # narration -- exercises Node 3's regex extraction path with
        # genuine signal, not just silent no-ops.
        if random.random() < 0.5:
            narration = f"{narration} Ref {order_id}"

        order_row = make_order(order_amount, order_ts, match_id)
        order_row["order_id"] = order_id  # keep in sync with the embedded reference
        order_row["record_hash"] = record_hash(order_id, order_row["amount"], order_row["order_ts"])
        orders.append(order_row)
        bank_rows.append(make_bank_row(bank_amount, bank_ts, match_id, narration))

    # --- Category 3: deceptive non-matches (false-positive traps) ---
    for _ in range(CONFIG["deceptive_nonmatch"]):
        base_amount = round(random.uniform(500, 50000), 2)
        base_ts = random_datetime_within()

        order_amount = base_amount
        bank_amount = round(base_amount + random.choice([-5, -2, 2, 5]), 2)  # close, unrelated
        bank_ts = base_ts + jittered_offset(1, 5)

        orders.append(make_order(order_amount, base_ts, None))
        bank_rows.append(make_bank_row(bank_amount, bank_ts, None, narration="Settlement"))

    # --- Category 4: clean non-matches (easy negatives) ---
    for _ in range(CONFIG["clean_nonmatch"]):
        orders.append(make_order(round(random.uniform(500, 50000), 2), random_datetime_within(), None))
        bank_rows.append(make_bank_row(round(random.uniform(500, 50000), 2), random_datetime_within(), None))

    random.shuffle(orders)
    random.shuffle(bank_rows)

    return pd.DataFrame(orders), pd.DataFrame(bank_rows)


if __name__ == "__main__":
    orders_df, bank_df = generate()

    orders_df.to_csv("data/output/orders.csv", index=False)
    bank_df.to_csv("data/output/bank_statements.csv", index=False)

    total = len(orders_df)
    matched = orders_df["true_match_id"].notna().sum()
    print(f"Generated {total} orders and {len(bank_df)} bank rows.")
    print(f"  Orders with a true match:    {matched}")
    print(f"  Orders with NO true match:   {total - matched}")
    print("Wrote data/output/orders.csv and data/output/bank_statements.csv")