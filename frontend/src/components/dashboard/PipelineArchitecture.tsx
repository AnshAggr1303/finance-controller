"use client";

import React from "react";
import { GitFork } from "lucide-react";

interface PipelineArchitectureProps {
  totalOrders: number;
  deterministicCount: number;
  regexCount: number;
  llmCount: number;
  humanReviewCount: number;
  rejectedCount: number;
}

export function PipelineArchitecture({
  totalOrders,
  deterministicCount,
  regexCount,
  llmCount,
  humanReviewCount,
  rejectedCount,
}: PipelineArchitectureProps) {
  const safeTotal = totalOrders > 0 ? totalOrders : 1;
  const detPct = ((deterministicCount / safeTotal) * 100).toFixed(1);
  const regexPct = ((regexCount / safeTotal) * 100).toFixed(1);
  const llmPct = ((llmCount / safeTotal) * 100).toFixed(1);
  const humanPct = ((humanReviewCount / safeTotal) * 100).toFixed(1);

  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl shadow-xs flex flex-col gap-4 border border-surface-container my-3">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-surface-container-low">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <GitFork className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-on-surface tracking-tight">
                Reconciliation Pipeline Architecture
              </h2>
              <span className="font-mono text-[11px] bg-primary-fixed text-on-primary-fixed font-semibold px-2 py-0.5 rounded">
                Threshold: ≥0.75
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">
              Deterministic Matcher (Exact, ~2% Fee ±0.1%, or ≤₹1 Rounding) → Regex Reference Extractor → Gemini LLM Matcher → Human Review
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-surface-container-low text-on-surface px-3 py-1 rounded-lg flex items-center gap-2 border border-surface-container">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>Feed: Bank Settlement Feed (Active)</span>
          </span>
        </div>
      </div>

      {/* 4 Stage Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Stage 1: Deterministic */}
        <div className="bg-surface-container-low/70 p-3.5 rounded-xl flex flex-col justify-between gap-2 border-t-2 border-secondary">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Stage 1: Deterministic
            </span>
            <span className="font-mono text-[10px] text-secondary font-semibold bg-secondary-container/50 px-1.5 py-0.5 rounded">
              Auto-match
            </span>
          </div>
          <div>
            <div className="text-xl font-semibold text-on-surface tracking-tight">
              {deterministicCount} / {totalOrders}
            </div>
            <span className="text-xs text-on-surface-variant">
              Exact hash &amp; net amount match
            </span>
          </div>
          <span className="font-mono text-secondary font-medium text-[11px]">
            Confidence: 1.000 ({detPct}%)
          </span>
        </div>

        {/* Stage 2: Regex Extractor */}
        <div className="bg-surface-container-low/70 p-3.5 rounded-xl flex flex-col justify-between gap-2 border-t-2 border-primary">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Stage 2: Regex Extractor
            </span>
            <span className="font-mono text-[10px] text-primary font-semibold bg-primary-fixed/60 px-1.5 py-0.5 rounded">
              Auto-match
            </span>
          </div>
          <div>
            <div className="text-xl font-semibold text-on-surface tracking-tight">
              {regexCount} / {totalOrders}
            </div>
            <span className="text-xs text-on-surface-variant">
              Invoice &amp; UTR pattern extraction
            </span>
          </div>
          <span className="font-mono text-primary font-medium text-[11px]">
            Confidence: ≥0.90 ({regexPct}%)
          </span>
        </div>

        {/* Stage 3: Gemini LLM */}
        <div className="bg-surface-container-low/70 p-3.5 rounded-xl flex flex-col justify-between gap-2 border-t-2 border-primary-container">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Stage 3: Gemini LLM
            </span>
            <span className="font-mono text-[10px] text-primary font-semibold bg-primary-fixed/40 px-1.5 py-0.5 rounded">
              ≥0.75 Conf
            </span>
          </div>
          <div>
            <div className="text-xl font-semibold text-on-surface tracking-tight">
              {llmCount} / {totalOrders}
            </div>
            <span className="text-xs text-on-surface-variant">
              Fuzzy merchant narration parsing
            </span>
          </div>
          <span className="font-mono text-tertiary font-medium text-[11px]">
            Confidence: 0.75–0.89 ({llmPct}%)
          </span>
        </div>

        {/* Stage 4: Human Review */}
        <div className="bg-surface-container-low/70 p-3.5 rounded-xl flex flex-col justify-between gap-2 border-t-2 border-error">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Stage 4: Human Review
            </span>
            <span className="font-mono text-[10px] bg-error-container text-on-error-container font-semibold px-1.5 py-0.5 rounded">
              Queue
            </span>
          </div>
          <div>
            <div className="text-xl font-semibold text-on-surface tracking-tight">
              {humanReviewCount} / {totalOrders}
            </div>
            <span className="text-xs text-on-surface-variant">
              {humanReviewCount} exceptions &amp; {rejectedCount} rejected
            </span>
          </div>
          <span className="font-mono text-error font-medium text-[11px]">
            Confidence: &lt;0.75 or discrepancy ({humanPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
