"""
Assembles the LangGraph state machine.

The matcher -> {END | exception_analyzer} edge is now a real
conditional edge -- the first genuine branch point in the graph.
Everything else stays linear until the human-in-loop phase.
"""

from langgraph.graph import END, StateGraph

from app.graph.nodes import (
    entity_extraction_node,
    exception_analyzer_node,
    ingestion_node,
    matcher_node,
    router_node,
)
from app.graph.state import ReconState


def route_after_matcher(state: ReconState) -> str:
    return "matched" if state.get("status") == "matched" else "unmatched"


def build_graph():
    workflow = StateGraph(ReconState)

    workflow.add_node("ingestion", ingestion_node)
    workflow.add_node("router", router_node)
    workflow.add_node("entity_extraction", entity_extraction_node)
    workflow.add_node("matcher", matcher_node)
    workflow.add_node("exception_analyzer", exception_analyzer_node)

    workflow.set_entry_point("ingestion")
    workflow.add_edge("ingestion", "router")
    workflow.add_edge("router", "entity_extraction")
    workflow.add_edge("entity_extraction", "matcher")

    workflow.add_conditional_edges(
        "matcher",
        route_after_matcher,
        {"matched": END, "unmatched": "exception_analyzer"},
    )
    workflow.add_edge("exception_analyzer", END)

    return workflow.compile()