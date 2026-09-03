"""
Assembles the deterministic (pass 1) LangGraph state machine.

Ends at the matcher -- Node 5 (exception analysis) deliberately does
NOT run as part of this graph. It runs as a separate second pass
across the whole batch in run_batch.py, after every order has had a
chance to claim a deterministic match. Running Node 5 inline, per
order, let an early record's loose LLM guess claim a bank row that a
later record's exact/rounding-tolerance match should have gotten
instead -- a real race condition, not a hypothetical one. Two passes
make that structurally impossible.
"""

from langgraph.graph import END, StateGraph

from app.graph.nodes import (
    entity_extraction_node,
    ingestion_node,
    matcher_node,
    router_node,
)
from app.graph.state import ReconState


def build_graph():
    workflow = StateGraph(ReconState)

    workflow.add_node("ingestion", ingestion_node)
    workflow.add_node("router", router_node)
    workflow.add_node("entity_extraction", entity_extraction_node)
    workflow.add_node("matcher", matcher_node)

    workflow.set_entry_point("ingestion")
    workflow.add_edge("ingestion", "router")
    workflow.add_edge("router", "entity_extraction")
    workflow.add_edge("entity_extraction", "matcher")
    workflow.add_edge("matcher", END)

    return workflow.compile()