import {
  BatchListItem,
  BatchSummaryResponse,
  MatchesResponse,
  ExceptionsResponse,
  ReviewDecisionResponse,
  ScorecardResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchBatchSummary(batchId: string): Promise<BatchSummaryResponse> {
  const url = `${API_BASE}/batches/${batchId}/summary`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch batch summary: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBatches(): Promise<BatchListItem[]> {
  const url = `${API_BASE}/batches`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch batches: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function runBatch(batchId: string): Promise<void> {
  const url = `${API_BASE}/batches/${batchId}/run`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to trigger batch run: ${res.status} ${res.statusText}`);
  }
}

export async function fetchBatchMatches(batchId: string): Promise<MatchesResponse> {
  const url = `${API_BASE}/batches/${batchId}/matches`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch matched records: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBatchExceptions(batchId: string): Promise<ExceptionsResponse> {
  const url = `${API_BASE}/batches/${batchId}/exceptions`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch exceptions: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBatchScorecard(batchId: string): Promise<ScorecardResponse> {
  const url = `${API_BASE}/batches/${batchId}/scorecard`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch scorecard: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function submitReviewDecision(
  batchId: string,
  reconciliationId: string,
  decision: string,
  confirmUnknown = false
): Promise<ReviewDecisionResponse> {
  const url = `${API_BASE}/batches/${batchId}/review/${reconciliationId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, confirm_unknown: confirmUnknown }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.detail || `Review submission failed: ${res.status}`);
  }
  return data;
}
