"use client";

import React from "react";
import { ScorecardResponse } from "@/lib/types";

interface ConfusionMatrixProps {
  data: ScorecardResponse;
}

function pct(n: number, total: number) {
  return total > 0 ? ((n / total) * 100).toFixed(1) : "0.0";
}

export function ConfusionMatrix({ data }: ConfusionMatrixProps) {
  const { tp, fp, fn, tn, total } = data;

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-on-surface">
          Reconciliation Ground Truth Confusion Matrix
        </h2>
        <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" /> Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error" /> Mismatch / Escalation
          </span>
        </div>
      </div>
      <p className="text-[11px] text-on-surface-variant mb-4">
        Model claim vs. <code className="font-mono">true_match_id</code> ground truth across{" "}
        {total} orders.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-secondary-container/30 border border-secondary/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              True Positives (TP)
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {pct(tp, total)}% of batch
            </span>
          </div>
          <span className="text-3xl font-semibold text-on-surface font-mono">{tp}</span>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Bank row claimed matches the order&apos;s true match token — correct automated pair.
          </p>
        </div>

        <div
          className={`border rounded-lg p-4 ${
            fp > 0
              ? "bg-error-container/30 border-error/30"
              : "bg-surface-container-low/40 border-surface-container"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface uppercase tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full ${fp > 0 ? "bg-error" : "bg-outline-variant"}`} />
              False Positives (FP)
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {pct(fp, total)}% mismatch
            </span>
          </div>
          <span className="text-3xl font-semibold text-on-surface font-mono">{fp}</span>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Bank row claimed, but it does not share the order&apos;s true match token — a wrong pair.
          </p>
        </div>

        <div
          className={`border rounded-lg p-4 ${
            fn > 0
              ? "bg-error-container/30 border-error/30"
              : "bg-surface-container-low/40 border-surface-container"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface uppercase tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full ${fn > 0 ? "bg-error" : "bg-outline-variant"}`} />
              False Negatives (FN)
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {pct(fn, total)}% missed
            </span>
          </div>
          <span className="text-3xl font-semibold text-on-surface font-mono">{fn}</span>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            No bank row claimed, but the order genuinely has a true match — a missed pair.
          </p>
        </div>

        <div className="bg-primary-fixed/15 border border-primary-fixed/40 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              True Negatives (TN)
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {pct(tn, total)}% isolated
            </span>
          </div>
          <span className="text-3xl font-semibold text-on-surface font-mono">{tn}</span>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            No bank row claimed, and the order genuinely has no match — correct abstention.
          </p>
        </div>
      </div>
    </div>
  );
}
