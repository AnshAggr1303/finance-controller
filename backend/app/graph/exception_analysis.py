"""
Node 5 -- LLM-based semantic exception analysis.

Only invoked for orders the deterministic matcher (Node 4) could not
resolve. Widens the candidate search, then asks Gemini to reason about
whether any surviving candidate is plausibly the true counterpart --
with a confidence score and specific reasoning, not just a yes/no.

Set GEMINI_MODEL in backend/.env to override the default.
"""

import os
import time

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

CONFIDENCE_THRESHOLD = 0.75
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")


class ExceptionVerdict(BaseModel):
    is_match: bool = Field(
        description="True only if one specific candidate is plausibly the true counterpart"
    )
    matched_bank_row_id: str | None = Field(
        default=None,
        description="id of the matching candidate bank row, required if is_match is true, else null",
    )
    confidence: float = Field(
        description="0.0 (no confidence) to 1.0 (certain) confidence in this verdict"
    )
    reasoning: str = Field(
        description="Concise explanation referencing specific amounts, dates, or narration text"
    )


_llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, temperature=0)
_structured_llm = _llm.with_structured_output(ExceptionVerdict)

PROMPT = """You are a financial reconciliation analyst. An order could NOT be
matched to a bank settlement using strict deterministic rules (exact amount,
2% gateway fee, or small rounding tolerance). Decide whether any of the
candidate bank rows below is still plausibly the true counterpart.

The ONLY discrepancy patterns known to be legitimate in this system are:
  1. A 2% gateway fee: the bank amount must equal order amount x 0.98,
     within a strict tolerance of +/-0.1 percentage points (i.e. the
     effective deduction must be between 1.9% and 2.1% of the order
     amount). A deduction of 2.3% or 1.7% is NOT a fee match -- do not
     round this tolerance up or treat "roughly 2%" as sufficient.
  2. A rounding difference of at most ~INR 1
  3. A multi-day settlement delay with the SAME amount as the order
  4. A transaction ID or customer reference explicitly present in the
     narration text that ties a candidate to this specific order

Do NOT invent other fee structures (e.g. a flat INR 2 or INR 5 "processing
fee") to explain an arbitrary amount difference -- if the gap does not match
one of the four patterns above, it is not evidence of a match, no matter how
plausible a fee story sounds.

Timestamp proximity or an identical sub-second/microsecond value between an
order and a candidate is NOT meaningful evidence on its own -- it can occur
by coincidence and must never be cited as a reason to report is_match=true
unless combined with one of the four patterns above.

Be conservative: only report is_match=true if you have real evidence per the
patterns above, not just a vaguely similar amount or a close timestamp. If
nothing fits, say so plainly -- an honest "no match" is far better than a
wrong guess in a finance system.

ORDER:
  order_id: {order_id}
  amount: {amount} {currency}
  order_ts: {order_ts}
  customer_ref: {customer_ref}

CANDIDATE BANK ROWS (already filtered to unclaimed, same currency, wider date window):
{candidates_block}
"""


def _format_candidates(candidates: list) -> str:
    if not candidates:
        return "(none)"
    lines = []
    for c in candidates:
        lines.append(
            f"  - id: {c['id']}, txn_id: {c['txn_id']}, amount: {c['amount']}, "
            f"settled_ts: {c['settled_ts']}, narration: \"{c['narration']}\""
        )
    return "\n".join(lines)


def analyze_exception(order: dict, candidates: list, retries: int = 2) -> ExceptionVerdict:
    """Call Gemini for a semantic verdict. Falls back to a conservative
    'no match, flag for review' verdict if the API call fails after
    retries -- a rate-limit hit should never crash the whole batch run.
    """
    if not candidates:
        return ExceptionVerdict(
            is_match=False,
            matched_bank_row_id=None,
            confidence=1.0,
            reasoning="No candidate bank rows exist within the widened search window -- genuinely unmatched.",
        )

    prompt = PROMPT.format(
        order_id=order["order_id"],
        amount=order["amount"],
        currency=order["currency"],
        order_ts=order["order_ts"],
        customer_ref=order.get("customer_ref", ""),
        candidates_block=_format_candidates(candidates),
    )

    last_error = None
    for attempt in range(retries + 1):
        try:
            verdict = _structured_llm.invoke(prompt)
            break
        except Exception as e:  # covers rate limits and transient API errors
            last_error = e
            verdict = None
            if attempt < retries:
                time.sleep(2 ** attempt)  # simple backoff: 1s, 2s

    if verdict is None:
        return ExceptionVerdict(
            is_match=False,
            matched_bank_row_id=None,
            confidence=0.0,
            reasoning=f"LLM call failed after retries ({last_error}); flagged for human review as a precaution.",
        )

    # Guard against a hallucinated ID -- never trust an LLM-chosen
    # identifier without checking it's actually one we offered it.
    if verdict.is_match:
        candidate_ids = {c["id"] for c in candidates}
        if verdict.matched_bank_row_id not in candidate_ids:
            return ExceptionVerdict(
                is_match=False,
                matched_bank_row_id=None,
                confidence=0.0,
                reasoning=(
                    "LLM proposed a candidate id not present in the actual search "
                    f"results; discarded as unreliable. Original reasoning: {verdict.reasoning}"
                ),
            )

    return verdict