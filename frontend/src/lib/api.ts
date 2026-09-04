import { BatchListItem, BatchSummaryResponse } from "./types";

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
