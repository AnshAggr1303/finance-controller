"""
The five graph nodes.

Nodes 1, 4, and 5 are fully implemented. Node 2's full multi-branch
dispatch (human corrections, vendor choice) arrives with the
human-in-loop phase. Node 3's regex/LLM entity extraction is next.
"""

from dateutil import parser as dtparser

from app.db import supabase
from app.graph.exception_analysis import CONFIDENCE_THRESHOLD, analyze_exception
from app.graph.matching import fetch_wide_candidates, find_best_match
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
    """Node 2 -- dispatch logic.

    TODO (human-in-loop phase): branch on state["human_response"] for
    corrections / vendor-choice re-entry. For now every fresh record
    proceeds to entity extraction.
    """
    return {**state, "current_node": "entity_extraction"}


def entity_extraction_node(state: ReconState) -> ReconState:
    """Node 3 -- regex-first entity extraction, LLM fallback. TODO (next sub-phase)."""
    return {**state, "current_node": "matcher", "extracted_entities": {}}


def matcher_node(state: ReconState) -> ReconState:
    """Node 4 -- deterministic mathematical matcher.

    Searches raw_bank_statements for the strongest legitimate match
    (exact, fee-adjusted, or rounding-tolerance), claiming candidates
    via a live query against reconciliation_state so claims survive
    crashed/resumed runs.
    """
    order = state["order_row"]
    batch_id = state["batch_id"]
    reconciliation_id = state["reconciliation_id"]

    bank_row, verdict = find_best_match(order, batch_id)

    if bank_row and verdict:
        supabase.table("reconciliation_state").update({
            "bank_row_id": bank_row["id"],
            "status": "matched",
            "confidence": 1.0,
        }).eq("id", reconciliation_id).execute()

        supabase.table("audit_trail").insert({
            "reconciliation_id": reconciliation_id,
            "node_name": "matcher",
            "decision_type": "deterministic_match",
            "reasoning": verdict["reasoning"],
            "confidence": 1.0,
        }).execute()

        return {
            **state,
            "bank_row": bank_row,
            "match_result": verdict,
            "current_node": "resolved",
            "status": "matched",
        }

    # No deterministic match -- expected for genuine non-matches.
    # Routes to the exception analyzer rather than force-matching.
    return {**state, "match_result": None, "current_node": "exception_analyzer"}


def exception_analyzer_node(state: ReconState) -> ReconState:
    """Node 5 -- LLM semantic exception analysis + confidence threshold.

    Widens the candidate search past what Node 4 tried, asks Gemini to
    reason about plausibility, and either auto-resolves (high confidence)
    or flags for human review (low confidence / genuinely no match).
    Always writes an audit_trail entry -- this is what makes the
    exception list "honest" rather than just unexplained.
    """
    order = state["order_row"]
    batch_id = state["batch_id"]
    reconciliation_id = state["reconciliation_id"]

    candidates = fetch_wide_candidates(order, batch_id)
    verdict = analyze_exception(order, candidates)

    if verdict.is_match and verdict.confidence >= CONFIDENCE_THRESHOLD and verdict.matched_bank_row_id:
        supabase.table("reconciliation_state").update({
            "bank_row_id": verdict.matched_bank_row_id,
            "status": "matched",
            "confidence": verdict.confidence,
        }).eq("id", reconciliation_id).execute()
        decision_type = "llm_match"
        final_status = "matched"
    else:
        supabase.table("reconciliation_state").update({
            "status": "exception",
            "confidence": verdict.confidence,
        }).eq("id", reconciliation_id).execute()
        decision_type = "exception_flag"
        final_status = "exception"

    supabase.table("audit_trail").insert({
        "reconciliation_id": reconciliation_id,
        "node_name": "exception_analyzer",
        "decision_type": decision_type,
        "reasoning": verdict.reasoning,
        "confidence": verdict.confidence,
    }).execute()

    return {
        **state,
        "match_result": verdict.model_dump(),
        "confidence": verdict.confidence,
        "current_node": "resolved",
        "status": final_status,
    }