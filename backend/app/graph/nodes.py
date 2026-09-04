"""
The five graph nodes. All core logic is now implemented -- Node 2's
full multi-branch dispatch (human corrections, vendor choice) is the
remaining piece, arriving with the human-in-loop phase.
"""

from dateutil import parser as dtparser

from app.db import supabase
from app.graph.entity_extraction import find_id_reference_match
from app.graph.exception_analysis import CONFIDENCE_THRESHOLD, analyze_exception
from app.graph.matching import fetch_candidates, fetch_wide_candidates, find_best_match, rank_candidates_for_review
from app.graph.state import ReconState


def ingestion_node(state: ReconState) -> ReconState:
    """Node 1 -- normalize the raw order record."""
    order = dict(state["order_row"])

    ts = order.get("order_ts")
    if isinstance(ts, str):
        order["order_ts"] = dtparser.isoparse(ts)

    order["amount"] = round(float(order["amount"]), 2)
    order["currency"] = (order.get("currency") or "INR").upper()

    return {**state, "order_row": order, "current_node": "router"}


def router_node(state: ReconState) -> ReconState:
    """Node 2 -- dispatch logic for fresh records.

    Human-response dispatch (confirm / choose / reject an exception) is
    handled by app/graph/human_review.py as a direct function, not a
    graph re-invocation -- see that module's docstring for why. Every
    fresh record proceeds to entity extraction.
    """
    return {**state, "current_node": "entity_extraction"}


def entity_extraction_node(state: ReconState) -> ReconState:
    """Node 3 -- regex-first entity extraction.

    Scans the same candidate pool Node 4 will search, looking for an
    explicit order ID or customer-name reference in any candidate's
    narration -- the strongest possible match evidence, checked before
    any arithmetic pattern.
    """
    order = state["order_row"]
    batch_id = state["batch_id"]

    candidates = fetch_candidates(order, batch_id)
    id_match = find_id_reference_match(order, candidates)

    return {
        **state,
        "current_node": "matcher",
        "extracted_entities": {"id_reference_match": id_match},
    }


def matcher_node(state: ReconState) -> ReconState:
    """Node 4 -- deterministic matcher.

    Checks Node 3's ID-reference match first (strongest evidence tier),
    then falls back to the amount-based tiers (exact / fee / rounding)
    if no explicit reference was found. Claims via a live query against
    reconciliation_state so claims survive crashed/resumed runs.
    """
    order = state["order_row"]
    batch_id = state["batch_id"]
    reconciliation_id = state["reconciliation_id"]

    id_match = (state.get("extracted_entities") or {}).get("id_reference_match")

    if id_match:
        bank_row = id_match["bank_row"]
        reasoning = id_match["reasoning"]
        decision_type = "id_reference_match"
    else:
        bank_row, verdict = find_best_match(order, batch_id)
        reasoning = verdict["reasoning"] if verdict else None
        decision_type = "deterministic_match"

    if bank_row and reasoning:
        update_res = (
            supabase.table("reconciliation_state")
            .update({
                "bank_row_id": bank_row["id"],
                "status": "matched",
                "confidence": 1.0,
            })
            .eq("id", reconciliation_id)
            .eq("status", "pending")
            .execute()
        )

        if update_res.data:
            supabase.table("audit_trail").insert({
                "reconciliation_id": reconciliation_id,
                "node_name": "matcher",
                "decision_type": decision_type,
                "reasoning": reasoning,
                "confidence": 1.0,
            }).execute()

        return {
            **state,
            "bank_row": bank_row,
            "match_result": {"reasoning": reasoning, "decision_type": decision_type},
            "current_node": "resolved",
            "status": "matched" if update_res.data else "skipped",
        }

    # No deterministic match -- expected for genuine non-matches.
    return {**state, "match_result": None, "current_node": "exception_analyzer"}


def exception_analyzer_node(state: ReconState) -> ReconState:
    """Node 5 -- LLM semantic exception analysis + confidence threshold.

    Widens the candidate search past what Node 4 tried, asks Gemini to
    reason about plausibility, and either auto-resolves (high confidence)
    or flags for human review (low confidence / genuinely no match).
    """
    order = state["order_row"]
    batch_id = state["batch_id"]
    reconciliation_id = state["reconciliation_id"]

    candidates = fetch_wide_candidates(order, batch_id)
    verdict = analyze_exception(order, candidates)

    if verdict.is_match and verdict.confidence >= CONFIDENCE_THRESHOLD and verdict.matched_bank_row_id:
        update_res = (
            supabase.table("reconciliation_state")
            .update({
                "bank_row_id": verdict.matched_bank_row_id,
                "status": "matched",
                "confidence": verdict.confidence,
            })
            .eq("id", reconciliation_id)
            .eq("status", "pending")
            .execute()
        )
        decision_type = "llm_match"
        final_status = "matched"
    else:
        review_candidates = rank_candidates_for_review(order, candidates)
        update_res = (
            supabase.table("reconciliation_state")
            .update({
                "status": "exception",
                "confidence": verdict.confidence,
                "review_candidates": review_candidates,
            })
            .eq("id", reconciliation_id)
            .eq("status", "pending")
            .execute()
        )
        decision_type = "exception_flag"
        final_status = "exception"

    # Guard: only write audit_trail if the status was still pending and updated
    if update_res.data:
        supabase.table("audit_trail").insert({
            "reconciliation_id": reconciliation_id,
            "node_name": "exception_analyzer",
            "decision_type": decision_type,
            "reasoning": verdict.reasoning,
            "confidence": verdict.confidence,
        }).execute()
    else:
        # The record moved on before this update (e.g. human review or concurrent run)
        final_status = "skipped"

    return {
        **state,
        "match_result": verdict.model_dump(),
        "confidence": verdict.confidence,
        "current_node": "resolved",
        "status": final_status,
    }