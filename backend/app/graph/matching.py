"""
Deterministic matching logic for Node 4.

Kept separate from nodes.py so the matching algorithm itself can be
tested independent of LangGraph plumbing. Candidate search uses a
live query against reconciliation_state (not an in-memory set) so
claims are crash-safe and resumable across separate script runs.
"""

from datetime import timedelta

from app.db import supabase

FEE_PCT = 0.02              # 2% payment gateway fee
ROUNDING_TOLERANCE = 1.00   # rupees -- covers paisa-level rounding drift
DATE_WINDOW_BEFORE = 1      # days -- settlement rarely predates the order
DATE_WINDOW_AFTER = 5       # days -- covers delayed-settlement noise


def get_claimed_bank_ids(batch_id: str) -> set:
    """Bank rows already matched to some order in this batch, read live
    from Supabase -- this is what makes claiming safe across a crashed
    and resumed run, unlike an in-memory set.
    """
    rows = (
        supabase.table("reconciliation_state")
        .select("bank_row_id")
        .eq("batch_id", batch_id)
        .eq("status", "matched")
        .execute()
        .data
    )
    return {r["bank_row_id"] for r in rows if r["bank_row_id"]}


def fetch_candidates(order: dict, batch_id: str) -> list:
    order_ts = order["order_ts"]
    window_start = (order_ts - timedelta(days=DATE_WINDOW_BEFORE)).isoformat()
    window_end = (order_ts + timedelta(days=DATE_WINDOW_AFTER)).isoformat()

    rows = (
        supabase.table("raw_bank_statements")
        .select("id, txn_id, amount, currency, settled_ts, narration")
        .eq("batch_id", batch_id)
        .eq("currency", order["currency"])
        .gte("settled_ts", window_start)
        .lte("settled_ts", window_end)
        .execute()
        .data
    )

    claimed = get_claimed_bank_ids(batch_id)
    return [r for r in rows if r["id"] not in claimed]


def evaluate_match(order: dict, candidate: dict):
    """Return a match verdict dict if this candidate fits a known
    legitimate pattern, else None. Caller ranks verdicts by strength."""
    order_amt = order["amount"]
    bank_amt = candidate["amount"]

    if abs(order_amt - bank_amt) < 0.01:
        return {
            "match_type": "exact",
            "reasoning": f"Exact amount match: order {order_amt} == bank {bank_amt}",
        }

    fee_adjusted = round(order_amt * (1 - FEE_PCT), 2)
    if abs(fee_adjusted - bank_amt) < 0.01:
        return {
            "match_type": "fee_adjusted",
            "reasoning": (
                f"Matched after {FEE_PCT*100:.0f}% gateway fee: "
                f"order {order_amt} x (1 - {FEE_PCT}) = {fee_adjusted} == bank {bank_amt}"
            ),
        }

    if abs(order_amt - bank_amt) <= ROUNDING_TOLERANCE:
        return {
            "match_type": "rounding_tolerance",
            "reasoning": (
                f"Matched within rounding tolerance: order {order_amt} vs "
                f"bank {bank_amt}, diff {abs(order_amt - bank_amt):.2f} <= {ROUNDING_TOLERANCE}"
            ),
        }

    return None


def find_best_match(order: dict, batch_id: str):
    """Search candidates, return (bank_row, verdict) for the strongest
    match found, or (None, None) if nothing qualifies deterministically.
    """
    candidates = fetch_candidates(order, batch_id)

    priority = {"exact": 0, "fee_adjusted": 1, "rounding_tolerance": 2}
    best, best_verdict = None, None

    for candidate in candidates:
        verdict = evaluate_match(order, candidate)
        if verdict is None:
            continue
        if best_verdict is None or priority[verdict["match_type"]] < priority[best_verdict["match_type"]]:
            best, best_verdict = candidate, verdict

    return best, best_verdict

# ---- Wider search, used only by Node 5 after Node 4 found nothing ----

WIDE_DATE_WINDOW_BEFORE = 2   # days
WIDE_DATE_WINDOW_AFTER = 15   # days -- deliberately much looser than Node 4


def fetch_wide_candidates(order: dict, batch_id: str) -> list:
    """Wider, amount-unfiltered candidate search for the exception analyzer.
    Node 4 already ruled out the narrow/strict matches -- this widens the
    net so an LLM has something real to reason about, rather than re-running
    the same search that already failed.
    """
    order_ts = order["order_ts"]
    window_start = (order_ts - timedelta(days=WIDE_DATE_WINDOW_BEFORE)).isoformat()
    window_end = (order_ts + timedelta(days=WIDE_DATE_WINDOW_AFTER)).isoformat()

    rows = (
        supabase.table("raw_bank_statements")
        .select("id, txn_id, amount, currency, settled_ts, narration")
        .eq("batch_id", batch_id)
        .eq("currency", order["currency"])
        .gte("settled_ts", window_start)
        .lte("settled_ts", window_end)
        .execute()
        .data
    )
    claimed = get_claimed_bank_ids(batch_id)
    return [r for r in rows if r["id"] not in claimed]

def rank_candidates_for_review(order: dict, candidates: list, top_n: int = 3) -> list:
    """Top-N candidates by amount closeness, serialized for storage/display.
    Used when Node 5 can't auto-resolve -- gives a human real numbered
    options instead of a single guess.
    """
    def diff(c):
        return abs(c["amount"] - order["amount"])

    ranked = sorted(candidates, key=diff)[:top_n]
    out = []
    for c in ranked:
        settled_ts = c["settled_ts"]
        out.append({
            "bank_row_id": c["id"],
            "txn_id": c["txn_id"],
            "amount": c["amount"],
            "settled_ts": settled_ts if isinstance(settled_ts, str) else settled_ts.isoformat(),
            "narration": c["narration"],
        })
    return out