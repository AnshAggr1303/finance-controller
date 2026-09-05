"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { ScorecardResponse } from "@/lib/types";

interface DiscrepancyLogProps {
  data: ScorecardResponse;
}

export function DiscrepancyLog({ data }: DiscrepancyLogProps) {
  const { problems } = data;

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-on-surface">
            Discrepancy Log (FP &amp; FN Rows)
          </h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Every order the model misclassified against{" "}
            <code className="font-mono">true_match_id</code> ground truth.
          </p>
        </div>
        <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
          {problems.length} flagged
        </span>
      </div>

      {problems.length === 0 ? (
        <div className="px-5 pb-6 flex items-center gap-2.5 text-secondary">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium text-on-surface">
            No false positives or false negatives — precision and recall are both 100%.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low/70 text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider h-9 border-y border-surface-container">
                <th className="py-2 px-5">Order ID</th>
                <th className="py-2 px-3">Classification</th>
                <th className="py-2 px-3">Final Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {problems.map((p) => (
                <tr key={p.order_id}>
                  <td className="py-3 px-5 font-mono font-semibold text-primary">{p.order_id}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-error-container text-on-error-container">
                      {p.classification === "FP" ? "FP (False Positive)" : "FN (False Negative)"}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-on-surface-variant">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
