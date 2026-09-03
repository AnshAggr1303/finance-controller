"""
Human-in-the-loop review for exception records.

Conceptually this IS the Router's other job: dispatching a human's
decision on a flagged record to a final outcome. Implemented as a
direct function here rather than re-invoking the LangGraph graph --
the actual work (parse response, apply it, write the audit trail) is
a single dispatch-and-write, not a multi-step pipeline that benefits
from graph machinery.

Handles combined "yes + correction" messages and numbered vendor
choice (1/2/3), per the original spec.

Run:
    python -m app.graph.human_review --batch-id <uuid>
"""

import argparse
import re
import sys

from app.db import supabase
from app.graph.matching import FEE_PCT, ROUNDING_TOLERANCE



def is_known_pattern(order_amount: float, bank_amount: float) -> bool:
    """Return True if the delta fits one of the three legitimate patterns
    from matching.py's evaluate_match -- identical algorithm, not a
    reimplementation, so the warning gate and the deterministic matcher
    always agree on what counts as a known pattern.

    Uses FEE_PCT and ROUNDING_TOLERANCE imported directly from matching.py
    so there is one source of truth for both constants.
    """
    if abs(order_amount - bank_amount) < 0.01:
        return True  # exact

    fee_adjusted = round(order_amount * (1 - FEE_PCT), 2)
    if abs(fee_adjusted - bank_amount) < 0.01:
        return True  # 2% gateway fee -- rupee check, same as evaluate_match

    if abs(order_amount - bank_amount) <= ROUNDING_TOLERANCE:
        return True  # rounding drift

    return False


def _pattern_label(order_amount: float, bank_amount: float) -> str:
    """Inline label for display -- mirrors is_known_pattern using the same
    three checks in the same order.
    """
    if abs(order_amount - bank_amount) < 0.01:
        return "exact"
    fee_adjusted = round(order_amount * (1 - FEE_PCT), 2)
    if abs(fee_adjusted - bank_amount) < 0.01:
        return "~2% fee"
    if abs(order_amount - bank_amount) <= ROUNDING_TOLERANCE:
        return "rounding"
    return "⚠ unknown pattern"


def format_candidate_line(i: int, c: dict, order_amount: float, currency: str) -> str:
    """Format one candidate row for display, including the signed delta and
    a pattern label so the reviewer sees the evidence quality at a glance.
    """
    delta = c["amount"] - order_amount
    sign = "+" if delta >= 0 else "-"
    label = _pattern_label(order_amount, c["amount"])
    return (
        f"  [{i}] {c['txn_id']}  {c['amount']} {currency}  "
        f"Δ {sign}₹{abs(delta):.2f} [{label}]  "
        f"{c['settled_ts']}  \"{c['narration']}\""
    )


def parse_human_response(text: str, num_candidates: int) -> dict:
    """Returns {action, chosen_index, correction_note}.
    action is one of: confirm | choose | reject | unclear.
    """
    text = (text or "").strip()
    if not text:
        return {"action": "unclear", "chosen_index": None, "correction_note": None}

    lower = text.lower()

    if lower in ("no", "n", "none", "reject", "none of these"):
        return {"action": "reject", "chosen_index": None, "correction_note": None}

    # Nothing to confirm/choose if there are no candidates at all --
    # "yes" or a number here is meaningless, only 'reject' makes sense.
    if num_candidates == 0:
        return {"action": "unclear", "chosen_index": None, "correction_note": text}

    # pure numeric choice: "2"
    if re.fullmatch(r"[1-9]", text):
        idx = int(text) - 1
        if idx < num_candidates:
            return {"action": "choose", "chosen_index": idx, "correction_note": None}
        return {"action": "unclear", "chosen_index": None, "correction_note": text}

    # combined "yes ..." messages, e.g. "yes", "yes 2", "yes, go with the second one"
    if lower.startswith("yes"):
        remainder = text[3:].lstrip(", ").strip()
        digit_match = re.search(r"\b([1-9])\b", remainder)
        chosen_index = (int(digit_match.group(1)) - 1) if digit_match else 0
        if chosen_index >= num_candidates:
            chosen_index = 0
        return {
            "action": "confirm",
            "chosen_index": chosen_index,
            "correction_note": remainder or None,
        }

    return {"action": "unclear", "chosen_index": None, "correction_note": text}


def apply_decision(
    reconciliation_id: str,
    candidates: list,
    decision: dict,
    raw_input: str,
    order_amount: float = 0.0,
    confirm_unknown: bool = False,
) -> str:
    if decision["action"] in ("confirm", "choose"):
        # Defensive check -- never index blindly, even if a parser bug
        # elsewhere hands us a bad index again.
        idx = decision["chosen_index"]
        if idx is None or not candidates or idx >= len(candidates):
            print("  No valid candidate to confirm -- did you mean 'no'?")
            return "unclear"

        candidate = candidates[idx]

        if not is_known_pattern(order_amount, candidate["amount"]):
            if not confirm_unknown:
                return "warning_required"

        try:
            supabase.table("reconciliation_state").update({
                "bank_row_id": candidate["bank_row_id"],
                "status": "matched",
                "confidence": 1.0,
            }).eq("id", reconciliation_id).execute()
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                print(
                    f"  {candidate['txn_id']} was already matched to a different order "
                    f"elsewhere in this batch -- pick another option or say 'no'."
                )
                return "unclear"
            raise

        reasoning = f"Human confirmed match to {candidate['txn_id']}"
        if decision["correction_note"]:
            reasoning += f" (note: {decision['correction_note']})"

        supabase.table("audit_trail").insert({
            "reconciliation_id": reconciliation_id,
            "node_name": "router",
            "decision_type": "human_override",
            "reasoning": reasoning,
            "confidence": 1.0,
        }).execute()

        supabase.table("human_overrides").insert({
            "reconciliation_id": reconciliation_id,
            "raw_input": raw_input,
            "parsed_action": decision["action"],
            "resolved_bank_row_id": candidate["bank_row_id"],
        }).execute()
        return "matched"

    if decision["action"] == "reject":
        supabase.table("reconciliation_state").update({
            "status": "rejected",
        }).eq("id", reconciliation_id).execute()

        supabase.table("audit_trail").insert({
            "reconciliation_id": reconciliation_id,
            "node_name": "router",
            "decision_type": "human_override",
            "reasoning": "Human confirmed this order has no matching bank settlement",
            "confidence": 1.0,
        }).execute()

        supabase.table("human_overrides").insert({
            "reconciliation_id": reconciliation_id,
            "raw_input": raw_input,
            "parsed_action": "reject",
        }).execute()
        return "rejected"

    print("  Could not understand that -- try 'yes', a number, or 'no'.")
    return "unclear"


def fetch_exceptions(batch_id: str) -> list:
    return (
        supabase.table("reconciliation_state")
        .select("id, order_row_id, review_candidates")
        .eq("batch_id", batch_id)
        .eq("status", "exception")
        .execute()
        .data
    )


def review_batch(batch_id: str):
    exceptions = fetch_exceptions(batch_id)
    print(f"{len(exceptions)} record(s) awaiting review in batch {batch_id}\n")

    for rec in exceptions:
        order = (
            supabase.table("raw_orders")
            .select("order_id, amount, currency, order_ts, customer_ref")
            .eq("id", rec["order_row_id"])
            .single()
            .execute()
            .data
        )
        candidates = rec.get("review_candidates") or []

        print(f"--- {order['order_id']} | {order['amount']} {order['currency']} | {order['customer_ref']} ---")
        if not candidates:
            print("  No candidate bank rows found at all -- only 'no' makes sense here.")
        for i, c in enumerate(candidates, start=1):
            print(format_candidate_line(i, c, order["amount"], order["currency"]))

        while True:
            response = input("  Your call (yes / yes <note> / 1-3 / no): ").strip()
            decision = parse_human_response(response, len(candidates))
            outcome = apply_decision(rec["id"], candidates, decision, response, order["amount"])
            if outcome == "warning_required":
                idx = decision["chosen_index"]
                candidate = candidates[idx] if idx is not None and idx < len(candidates) else {}
                delta = candidate.get("amount", 0.0) - order["amount"]
                sign = "+" if delta >= 0 else "-"
                print(
                    f"\n  ⚠  This doesn't match a known pattern — "
                    f"Δ {sign}₹{abs(delta):.2f} is not exact, ~2% fee, or ≤₹1 rounding."
                )
                confirm = input("  Are you sure you want to confirm this? (y/n): ").strip().lower()
                if confirm == "y":
                    outcome = apply_decision(
                        rec["id"], candidates, decision, response, order["amount"], confirm_unknown=True
                    )
                else:
                    print("  Aborted — re-enter your decision or say 'no' to reject.")
                    outcome = "unclear"

            if outcome != "unclear":
                print(f"  -> {outcome}\n")
                break


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-id", required=True)
    args = parser.parse_args()
    review_batch(args.batch_id)