"""
Node 3 -- regex-first entity extraction from bank narration text.

Scans candidate bank rows' narration for a direct reference back to
the order (explicit order ID, or a Hinglish "X se" / plain-name
reference to the customer). This is checked BEFORE Node 4's amount
tiers -- an explicit ID reference is stronger evidence than any
arithmetic pattern, since amount matches alone can be coincidental.
"""

import re

ORDER_ID_PATTERN = re.compile(r"\bORD-\d{4,}\b", re.IGNORECASE)
HINGLISH_SE_PATTERN = re.compile(r"([A-Za-z]+)\s+se\b", re.IGNORECASE)


def extract_entities_from_narration(narration: str) -> dict:
    narration = narration or ""
    return {
        "order_ids": ORDER_ID_PATTERN.findall(narration),
        "se_references": HINGLISH_SE_PATTERN.findall(narration),
    }


def find_id_reference_match(order: dict, candidates: list) -> dict | None:
    """Regex-first: does any candidate's narration explicitly reference
    this order's ID or customer name? Returns the strongest match found,
    or None if nothing in any candidate's narration references this order.
    """
    order_id = order["order_id"]
    customer_ref = (order.get("customer_ref") or "").strip()

    for candidate in candidates:
        narration = candidate.get("narration") or ""
        entities = extract_entities_from_narration(narration)

        if order_id in entities["order_ids"]:
            return {
                "bank_row": candidate,
                "reasoning": f"Narration explicitly references order ID {order_id}: \"{narration}\"",
            }

        if customer_ref and customer_ref.lower() in narration.lower():
            return {
                "bank_row": candidate,
                "reasoning": f"Narration references customer name '{customer_ref}': \"{narration}\"",
            }

        for se_name in entities["se_references"]:
            first_name = customer_ref.split()[0].lower() if customer_ref else ""
            if first_name and se_name.lower() == first_name:
                return {
                    "bank_row": candidate,
                    "reasoning": (
                        f"Hinglish phrasing '{se_name} se' references customer "
                        f"'{customer_ref}': \"{narration}\""
                    ),
                }

    return None