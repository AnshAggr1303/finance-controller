"""
Shared state that flows through every node in the reconciliation graph.

One instance of this state = one order working its way through the
graph. total=False means every field is optional at the type level --
nodes fill in more of it as the record progresses, they don't need to
know about fields other nodes haven't set yet.
"""

from typing import Any, Optional, TypedDict


class ReconState(TypedDict, total=False):
    batch_id: str
    reconciliation_id: str          # row id in the reconciliation_state table

    order_row: dict                 # the focal order (never includes true_match_id)
    bank_row: Optional[dict]        # the bank row chosen as the best candidate, once found

    current_node: str               # ingestion | router | entity_extraction
                                     # | matcher | exception_analyzer | resolved
    status: str                     # pending | matched | exception | resolved | rejected

    extracted_entities: Optional[dict]   # filled by Node 3
    match_result: Optional[dict]         # filled by Node 4: {matched, reasoning, ...}
    confidence: Optional[float]          # filled by Node 5

    human_response: Optional[str]        # populated only when resuming after a pause