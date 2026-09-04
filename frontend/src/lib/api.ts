import { BatchListItem, BatchSummaryResponse, MatchesResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

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
