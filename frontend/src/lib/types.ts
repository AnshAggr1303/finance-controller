export interface AuditTrailSummaryItem {
  id: string;
  reconciliation_id: string;
  node_name: string;
  decision_type: string;
  order_id?: string | null;
  txn_id?: string | null;
  amount?: number | null;
  confidence?: number | null;
  reasoning?: string | null;
  created_at?: string | null;
}

export interface BatchSummaryResponse {
  batch_id: string;
  id: string;
  label: string;
  created_at: string;
  status: string;
  total_orders: number;
  order_count: number;
  matched_count: number;
  exception_count: number;
  rejected_count: number;
  pending_count: number;
  match_rate: number;
  match_rate_pct: number;
  total_settled_amount: number;
  pipeline_breakdown: {
    deterministic_match?: number;
    id_reference_match?: number;
    llm_match?: number;
    exception_flag?: number;
    human_override?: number;
    [key: string]: number | undefined;
  };
  recent_audit_trail: AuditTrailSummaryItem[];
}

export interface MatchItem {
  reconciliation_id: string;
  order_id: string;
  customer_ref: string;
  order_amount: number;
  currency: string;
  order_ts?: string | null;
  bank_txn_id?: string | null;
  bank_amount?: number | null;
  narration?: string | null;
  settled_ts?: string | null;
  delta?: number | null;
  decision_type?: string | null;
  match_subtype?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  matched_at?: string | null;
}

export interface MatchesResponse {
  batch_id: string;
  matches_count: number;
  matches: MatchItem[];
}

export interface BatchListItem {
  id: string;
  batch_id: string;
  label: string;
  created_at: string;
  order_count: number;
  matched_count: number;
  exception_count: number;
  rejected_count: number;
  pending_count: number;
  match_rate: number;
  match_rate_pct: number;
  status: string;
}
