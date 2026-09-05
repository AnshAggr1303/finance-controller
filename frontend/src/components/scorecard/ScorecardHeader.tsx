"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, CheckCircle2, ScanSearch, Scale, AlertTriangle } from "lucide-react";
import { ScorecardResponse } from "@/lib/types";

interface ScorecardHeaderProps {
  batchId: string;
  batchLabel: string;
  data: ScorecardResponse;
}

export function ScorecardHeader({ batchId, batchLabel, data }: ScorecardHeaderProps) {
  const precisionPct = (data.precision * 100).toFixed(2);
  const recallPct = (data.recall * 100).toFixed(2);
  const f1Pct = (data.f1 * 100).toFixed(2);
  const exceptionPct = (data.exception_rate * 100).toFixed(2);

  return (
    <div className="flex flex-col gap-4 mb-2 pt-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <Link href="/batches" className="hover:text-primary transition-colors">
          Batches
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/?batch=${batchId}`} className="hover:text-primary transition-colors font-mono">
          {batchLabel}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Performance Scorecard</span>
      </div>

      <div>
        <h1 className="text-2xl lg:text-[28px] font-semibold text-on-surface tracking-tight">
          Batch Reconciliation Scorecard &amp; Accuracy Audit
        </h1>
        <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
          Ground-truth classification of all {data.total} orders in{" "}
          <span className="font-mono bg-surface-container-low px-1 py-0.5 rounded">
            {batchLabel}
          </span>{" "}
          against <code className="font-mono">true_match_id</code> — scored by the same
          logic as <code className="font-mono">data/scoring.py</code>, not a separate
          reimplementation.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Precision
            </span>
            <CheckCircle2 className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-2xl font-semibold text-on-surface font-mono">{precisionPct}%</span>
          <span className="text-[10px] text-on-surface-variant font-mono">
            TP / (TP+FP) &middot; {data.tp}/{data.tp + data.fp}
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Recall
            </span>
            <ScanSearch className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-2xl font-semibold text-on-surface font-mono">{recallPct}%</span>
          <span className="text-[10px] text-on-surface-variant font-mono">
            TP / (TP+FN) &middot; {data.tp}/{data.tp + data.fn}
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              F1 Score
            </span>
            <Scale className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-2xl font-semibold text-on-surface font-mono">{f1Pct}%</span>
          <span className="text-[10px] text-on-surface-variant font-mono">
            2&middot;(P&middot;R)/(P+R)
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Exception Rate
            </span>
            <AlertTriangle className="w-4 h-4 text-tertiary" />
          </div>
          <span className="text-2xl font-semibold text-on-surface font-mono">{exceptionPct}%</span>
          <span className="text-[10px] text-on-surface-variant font-mono">
            {data.exceptions}/{data.total} still in human queue
          </span>
        </div>
      </div>
    </div>
  );
}
