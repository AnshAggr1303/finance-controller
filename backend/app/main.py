"""
FastAPI application wrapping the finance controller batch orchestration:

Endpoints:
  - GET  /batches: List all batches with summary stats and status.
  - POST /batches: Generate a dataset and push to Supabase as a new batch.
  - GET  /batches/{id}/summary: Summary metrics, pipeline stage breakdown, and recent audit activity.
  - POST /batches/{id}/run: Execute two-pass batch reconciliation graph.
  - GET  /batches/{id}/exceptions: List records awaiting human review with candidates.
  - POST /batches/{id}/review/{reconciliation_id}: Submit a human review decision.
"""

import math
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load backend/.env before importing data modules that expect env vars
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Ensure repo root is on sys.path for data.generator import
REPO_ROOT = str(Path(__file__).resolve().parents[2])
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from app.db import supabase
import data.generator as generator
import data.push_to_db as push_to_db
from app.graph.human_review import (
    _pattern_label,
    apply_decision,
    fetch_exceptions,
    format_candidate_line,
    is_known_pattern,
    parse_human_response,
)
from app.graph.run_batch import (
    fetch_pass2_candidates,
    fetch_pending_orders,
    run_pass1_for_order,
    run_pass2_for_record,
)

app = FastAPI(
    title="Finance Controller API",
    description="Batch reconciliation system for matching e-commerce orders to bank statements",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clean_record(record: dict) -> dict:
    """Replace pandas/numpy NaN floats with None for valid JSON serialization."""
    return {
        k: (None if isinstance(v, float) and math.isnan(v) else v)
        for k, v in record.items()
    }


# ── Pydantic Request / Response Models ───────────────────────────────────────

class CreateBatchRequest(BaseModel):
    label: Optional[str] = "Generated Batch"


class CreateBatchResponse(BaseModel):
    batch_id: str
    label: str
    orders_count: int
    bank_statements_count: int


class RunBatchResponse(BaseModel):
    batch_id: str
    pass1_orders_processed: int
    pass2_records_processed: int
    status: str


class CandidateItem(BaseModel):
    index: int
    id: str
    txn_id: str
    amount: float
    currency: str
    settled_ts: str
    narration: str
    delta: float
    is_known_pattern: bool
    pattern_label: str
    formatted_line: str


class ExceptionItem(BaseModel):
    reconciliation_id: str
    order_row_id: str
    order_id: str
    amount: float
    currency: str
    customer_ref: str
    order_ts: Optional[str] = None
    review_candidates: List[CandidateItem]


class ExceptionsResponse(BaseModel):
    batch_id: str
    exceptions_count: int
    exceptions: List[ExceptionItem]


class ReviewDecisionRequest(BaseModel):
    decision: str  # e.g., "1", "yes", "no", "yes 2", "reject"
    confirm_unknown: Optional[bool] = False


class ReviewDecisionResponse(BaseModel):
    reconciliation_id: str
    status: str
    action: Optional[str] = None
    message: Optional[str] = None


class BatchListItem(BaseModel):
    id: str
    batch_id: str
    label: str
    created_at: str
    order_count: int
    matched_count: int
    exception_count: int
    rejected_count: int
    pending_count: int
    match_rate: float
    match_rate_pct: float
    status: str


class AuditTrailSummaryItem(BaseModel):
    id: str
    reconciliation_id: str
    node_name: str
    decision_type: str
    order_id: Optional[str] = None
    txn_id: Optional[str] = None
    amount: Optional[float] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None
    created_at: Optional[str] = None


class BatchSummaryResponse(BaseModel):
    batch_id: str
    id: str
    label: str
    created_at: str
    status: str
    total_orders: int
    order_count: int
    matched_count: int
    exception_count: int
    rejected_count: int
    pending_count: int
    match_rate: float
    match_rate_pct: float
    total_settled_amount: float
    pipeline_breakdown: Dict[str, int]
    recent_audit_trail: List[AuditTrailSummaryItem]


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Finance Controller API"}


@app.get("/batches", response_model=List[BatchListItem])
def list_batches():
    """List all batches with summary metrics (order count, match counts, match rate, status)."""
    try:
        res = (
            supabase.table("batches")
            .select("id, label, created_at, raw_orders(id), reconciliation_state(status)")
            .order("created_at", desc=True)
            .execute()
        )
        batches_data = res.data or []
        items: List[BatchListItem] = []

        for b in batches_data:
            batch_id = b["id"]
            orders = b.get("raw_orders") or []
            recons = b.get("reconciliation_state") or []
            order_count = len(orders)
            matched = sum(1 for r in recons if r.get("status") == "matched")
            exception = sum(1 for r in recons if r.get("status") == "exception")
            rejected = sum(1 for r in recons if r.get("status") == "rejected")
            pending = sum(1 for r in recons if r.get("status") == "pending") + max(0, order_count - len(recons))

            match_rate = round(matched / order_count, 4) if order_count > 0 else 0.0
            match_rate_pct = round(match_rate * 100, 2)

            if order_count > 0 and len(recons) >= order_count and pending == 0:
                status = "completed"
            elif len(recons) > 0 or pending > 0:
                status = "running"
            else:
                status = "pending"

            items.append(
                BatchListItem(
                    id=batch_id,
                    batch_id=batch_id,
                    label=b.get("label") or "Unnamed Batch",
                    created_at=str(b.get("created_at", "")),
                    order_count=order_count,
                    matched_count=matched,
                    exception_count=exception,
                    rejected_count=rejected,
                    pending_count=pending,
                    match_rate=match_rate,
                    match_rate_pct=match_rate_pct,
                    status=status,
                )
            )

        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list batches: {str(e)}")


@app.post("/batches", response_model=CreateBatchResponse)
def create_and_push_batch(req: CreateBatchRequest):
    """Generate a synthetic dataset and push it to Supabase as a new batch."""
    try:
        orders_df, bank_df = generator.generate()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data generation failed: {str(e)}")

    owner_user_id = os.environ.get("SUPABASE_OWNER_USER_ID", "40c471aa-2499-49e2-b650-9192ac062763")
    label = req.label or "Generated Batch"

    try:
        batch_res = supabase.table("batches").insert({
            "user_id": owner_user_id,
            "label": label,
        }).execute()
        batch_id = batch_res.data[0]["id"]

        orders_df["batch_id"] = batch_id
        bank_df["batch_id"] = batch_id

        orders_records = [push_to_db.clean_record(r) for r in orders_df.to_dict("records")]
        bank_records = [push_to_db.clean_record(r) for r in bank_df.to_dict("records")]

        supabase.table("raw_orders").insert(orders_records).execute()
        supabase.table("raw_bank_statements").insert(bank_records).execute()

        return CreateBatchResponse(
            batch_id=batch_id,
            label=label,
            orders_count=len(orders_records),
            bank_statements_count=len(bank_records),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database push failed: {str(e)}")


@app.post("/batches/{id}/run", response_model=RunBatchResponse)
def run_batch(id: str):
    """Execute the two-pass batch reconciliation pipeline for a given batch ID."""
    # Verify batch exists
    batch = supabase.table("batches").select("id").eq("id", id).execute().data
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {id} not found")

    try:
        # Pass 1: Deterministic matching across all unprocessed orders
        orders = fetch_pending_orders(id)
        pass1_count = 0
        for order in orders:
            run_pass1_for_order(order, id)
            pass1_count += 1

        # Pass 2: LLM reasoning on remaining unresolved exception candidates
        pending = fetch_pass2_candidates(id)
        pass2_count = 0
        for rec in pending:
            run_pass2_for_record(rec, id)
            pass2_count += 1

        return RunBatchResponse(
            batch_id=id,
            pass1_orders_processed=pass1_count,
            pass2_records_processed=pass2_count,
            status="completed",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch run failed: {str(e)}")


@app.get("/batches/{id}/summary", response_model=BatchSummaryResponse)
def get_batch_summary(id: str):
    """Return aggregate counts, settled amount, pipeline-stage breakdown, and 20 recent audit entries."""
    # 1. Verify batch exists
    batch_res = (
        supabase.table("batches")
        .select("id, label, created_at")
        .eq("id", id)
        .execute()
    )
    if not batch_res.data:
        raise HTTPException(status_code=404, detail=f"Batch {id} not found")

    batch = batch_res.data[0]

    try:
        # 2. Total orders in this batch
        orders_res = supabase.table("raw_orders").select("id").eq("batch_id", id).execute()
        total_orders = len(orders_res.data or [])

        # 3. Reconciliation state records with matched bank amount for settlement
        recon_res = (
            supabase.table("reconciliation_state")
            .select("id, status, raw_bank_statements(amount)")
            .eq("batch_id", id)
            .execute()
        )
        recons = recon_res.data or []
        matched_cnt = sum(1 for r in recons if r.get("status") == "matched")
        exception_cnt = sum(1 for r in recons if r.get("status") == "exception")
        rejected_cnt = sum(1 for r in recons if r.get("status") == "rejected")
        pending_cnt = sum(1 for r in recons if r.get("status") == "pending") + max(0, total_orders - len(recons))

        total_settled = sum(
            float(r["raw_bank_statements"]["amount"])
            for r in recons
            if r.get("status") == "matched"
            and r.get("raw_bank_statements")
            and r["raw_bank_statements"].get("amount") is not None
        )

        match_rate = round(matched_cnt / total_orders, 4) if total_orders > 0 else 0.0
        match_rate_pct = round(match_rate * 100, 2)

        if total_orders > 0 and len(recons) >= total_orders and pending_cnt == 0:
            status = "completed"
        elif len(recons) > 0 or pending_cnt > 0:
            status = "running"
        else:
            status = "pending"

        # 4. Pipeline-stage breakdown by decision_type from audit_trail
        audits_res = (
            supabase.table("audit_trail")
            .select("decision_type, reconciliation_state!inner(batch_id)")
            .eq("reconciliation_state.batch_id", id)
            .execute()
        )
        pipeline_breakdown = {
            "deterministic_match": 0,
            "id_reference_match": 0,
            "llm_match": 0,
            "exception_flag": 0,
            "human_override": 0,
        }
        for a in (audits_res.data or []):
            dt = a.get("decision_type")
            if dt:
                pipeline_breakdown[dt] = pipeline_breakdown.get(dt, 0) + 1

        # 5. 20 most recent audit_trail entries
        recent_audits = (
            supabase.table("audit_trail")
            .select(
                "id, reconciliation_id, node_name, decision_type, reasoning, confidence, created_at, "
                "reconciliation_state!inner(batch_id, raw_orders(order_id, amount), raw_bank_statements(txn_id, amount))"
            )
            .eq("reconciliation_state.batch_id", id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
            or []
        )

        recent_entries: List[AuditTrailSummaryItem] = []
        for a in recent_audits:
            recon = a.get("reconciliation_state") or {}
            order = recon.get("raw_orders") or {}
            bank = recon.get("raw_bank_statements") or {}

            amt = order.get("amount")
            if amt is None and bank:
                amt = bank.get("amount")

            recent_entries.append(
                AuditTrailSummaryItem(
                    id=a["id"],
                    reconciliation_id=a["reconciliation_id"],
                    node_name=a.get("node_name", ""),
                    decision_type=a.get("decision_type", ""),
                    order_id=order.get("order_id"),
                    txn_id=bank.get("txn_id") if bank else None,
                    amount=float(amt) if amt is not None else None,
                    confidence=float(a["confidence"]) if a.get("confidence") is not None else None,
                    reasoning=a.get("reasoning"),
                    created_at=str(a.get("created_at", "")),
                )
            )

        return BatchSummaryResponse(
            batch_id=id,
            id=id,
            label=batch.get("label") or "Unnamed Batch",
            created_at=str(batch.get("created_at", "")),
            status=status,
            total_orders=total_orders,
            order_count=total_orders,
            matched_count=matched_cnt,
            exception_count=exception_cnt,
            rejected_count=rejected_cnt,
            pending_count=pending_cnt,
            match_rate=match_rate,
            match_rate_pct=match_rate_pct,
            total_settled_amount=round(total_settled, 2),
            pipeline_breakdown=pipeline_breakdown,
            recent_audit_trail=recent_entries,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch summary: {str(e)}")


@app.get("/batches/{id}/exceptions", response_model=ExceptionsResponse)
def get_batch_exceptions(id: str):
    """List all records in a batch currently awaiting human review with candidate matches."""
    rec_rows = fetch_exceptions(id)
    exceptions_list: List[ExceptionItem] = []

    for rec in rec_rows:
        order_res = (
            supabase.table("raw_orders")
            .select("order_id, amount, currency, order_ts, customer_ref")
            .eq("id", rec["order_row_id"])
            .single()
            .execute()
        )
        if not order_res.data:
            continue
        order = order_res.data
        order_amount = float(order["amount"])
        candidates_raw = rec.get("review_candidates") or []

        candidate_items: List[CandidateItem] = []
        for i, c in enumerate(candidates_raw, start=1):
            bank_amt = float(c.get("amount", 0.0))
            delta = round(bank_amt - order_amount, 2)
            candidate_items.append(
                CandidateItem(
                    index=i,
                    id=c.get("id", str(i)),
                    txn_id=c.get("txn_id", ""),
                    amount=bank_amt,
                    currency=c.get("currency", order.get("currency", "INR")),
                    settled_ts=str(c.get("settled_ts", "")),
                    narration=c.get("narration", ""),
                    delta=delta,
                    is_known_pattern=is_known_pattern(order_amount, bank_amt),
                    pattern_label=_pattern_label(order_amount, bank_amt),
                    formatted_line=format_candidate_line(
                        i, c, order_amount, order.get("currency", "INR")
                    ),
                )
            )

        exceptions_list.append(
            ExceptionItem(
                reconciliation_id=rec["id"],
                order_row_id=rec["order_row_id"],
                order_id=order["order_id"],
                amount=order_amount,
                currency=order["currency"],
                customer_ref=order["customer_ref"],
                order_ts=str(order.get("order_ts", "")),
                review_candidates=candidate_items,
            )
        )

    return ExceptionsResponse(
        batch_id=id,
        exceptions_count=len(exceptions_list),
        exceptions=exceptions_list,
    )


@app.post("/batches/{id}/review/{reconciliation_id}", response_model=ReviewDecisionResponse)
def submit_review_decision(
    id: str,
    reconciliation_id: str,
    req: ReviewDecisionRequest,
):
    """Submit a human decision for a specific exception record in a batch."""
    # Query reconciliation record
    rec_res = (
        supabase.table("reconciliation_state")
        .select("id, order_row_id, review_candidates, status, batch_id")
        .eq("id", reconciliation_id)
        .eq("batch_id", id)
        .execute()
    )
    if not rec_res.data:
        raise HTTPException(
            status_code=404,
            detail=f"Reconciliation record {reconciliation_id} not found in batch {id}",
        )

    rec = rec_res.data[0]
    if rec["status"] != "exception":
        raise HTTPException(
            status_code=400,
            detail=f"Record is in status '{rec['status']}', not 'exception'",
        )

    # Fetch order amount
    order_res = (
        supabase.table("raw_orders")
        .select("amount")
        .eq("id", rec["order_row_id"])
        .single()
        .execute()
    )
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order row not found")

    order_amount = float(order_res.data["amount"])
    candidates = rec.get("review_candidates") or []

    # Re-use parse_human_response from human_review.py
    decision = parse_human_response(req.decision, len(candidates))
    if decision["action"] == "unclear":
        raise HTTPException(
            status_code=400,
            detail="Unclear decision input. Use '1', '2', 'yes', 'yes 2', or 'no'.",
        )

    # Re-use apply_decision from human_review.py
    outcome = apply_decision(
        reconciliation_id=reconciliation_id,
        candidates=candidates,
        decision=decision,
        raw_input=req.decision,
        order_amount=order_amount,
        confirm_unknown=req.confirm_unknown or False,
    )

    if outcome == "warning_required":
        raise HTTPException(
            status_code=400,
            detail=(
                "Selected candidate does not match a known reconciliation pattern (exact, ~2% fee, or ≤₹1 rounding). "
                "Set confirm_unknown: true in your request body to explicitly override and confirm."
            ),
        )

    if outcome == "already_reviewed":
        raise HTTPException(
            status_code=409,
            detail="Record has already been reviewed or status is no longer 'exception'.",
        )

    if outcome == "unclear":
        raise HTTPException(
            status_code=400,
            detail="Could not apply decision. Candidate may be invalid or already claimed.",
        )

    return ReviewDecisionResponse(
        reconciliation_id=reconciliation_id,
        status=outcome,
        action=decision["action"],
        message=f"Successfully applied decision '{decision['action']}' -> {outcome}",
    )
