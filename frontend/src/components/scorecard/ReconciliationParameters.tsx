"use client";

import React from "react";
import { ScorecardResponse } from "@/lib/types";

interface ReconciliationParametersProps {
  data: ScorecardResponse;
}

// Real constants from the deterministic matcher and exception analyzer —
// backend/app/graph/matching.py (FEE_PCT=0.02, ROUNDING_TOLERANCE=1.00) and
// exception_analysis.py (CONFIDENCE_THRESHOLD=0.75). Not exposed by any
// endpoint (they're module constants, not per-batch config), so shown here
// as the same fixed reference values already displayed on the Dashboard's
// pipeline architecture card.
export function ReconciliationParameters({ data }: ReconciliationParametersProps) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-on-surface">Active Reconciliation Parameters</h2>
        <span className="font-mono text-[11px] text-on-surface-variant">
          {data.total} orders scored
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="block text-[11px] text-on-surface-variant uppercase tracking-wider">
            LLM Auto-Match Threshold
          </span>
          <span className="block text-base font-semibold text-on-surface mt-1">
            &ge; 0.75 confidence
          </span>
          <span className="block text-[11px] text-secondary">Node 5 auto-clear</span>
        </div>
        <div>
          <span className="block text-[11px] text-on-surface-variant uppercase tracking-wider">
            Gateway Fee Tolerance
          </span>
          <span className="block text-base font-semibold text-on-surface mt-1">
            ~2% fee, ±0.1pp
          </span>
          <span className="block text-[11px] text-on-surface-variant">
            plus ≤₹1.00 rounding drift
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-on-surface-variant uppercase tracking-wider">
            Sample Audit Size
          </span>
          <span className="block text-base font-semibold text-on-surface mt-1">
            {data.total} orders (100%)
          </span>
          <span className="block text-[11px] text-secondary">Complete sample — not a subset</span>
        </div>
      </div>
    </div>
  );
}
