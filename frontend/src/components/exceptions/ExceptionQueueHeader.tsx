"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { ExceptionItem } from "@/lib/types";

export const QUEUE_FILTERS = ["All Exceptions", "Multiple Candidates", "Unknown Pattern"] as const;

interface ExceptionQueueHeaderProps {
  batchId: string;
  batchLabel: string;
  exceptions: ExceptionItem[];
  activeFilter: string;
  onFilterChange: (f: string) => void;
  activeIndex: number;
  totalInFilter: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ExceptionQueueHeader({
  batchId,
  batchLabel,
  exceptions,
  activeFilter,
  onFilterChange,
  activeIndex,
  totalInFilter,
  onPrev,
  onNext,
}: ExceptionQueueHeaderProps) {
  const counts: Record<string, number> = {
    "All Exceptions": exceptions.length,
    "Multiple Candidates": exceptions.filter((e) => e.review_candidates.length > 1).length,
    "Unknown Pattern": exceptions.filter((e) =>
      e.review_candidates.some((c) => !c.is_known_pattern)
    ).length,
  };

  return (
    <div className="flex flex-col gap-3 mb-2 pt-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <Link href="/batches" className="hover:text-primary transition-colors">
          Batches
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/?batch=${batchId}`} className="hover:text-primary transition-colors font-mono">
          {batchLabel}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Exception Review</span>
      </div>

      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
          Exception Review Queue
        </h1>
        <span className="inline-flex items-center bg-error-container text-on-error-container font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full">
          {exceptions.length} PENDING
        </span>
      </div>
      <p className="text-xs text-on-surface-variant -mt-1">
        Orders the pipeline could not auto-resolve — deterministic matcher found no candidate,
        and Node 5 either couldn&apos;t reach ≥0.75 confidence or failed to run. Operator
        confirmation required.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {QUEUE_FILTERS.map((f) => {
            const count = counts[f] ?? 0;
            const isActive = activeFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFilterChange(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-on-surface text-surface"
                    : "bg-surface-container-lowest text-on-surface-variant border border-surface-container hover:bg-surface-container-low"
                }`}
              >
                {f} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {totalInFilter > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
            <span>
              Queue: {activeIndex + 1} of {totalInFilter}
            </span>
            <button
              type="button"
              onClick={onPrev}
              disabled={activeIndex === 0}
              className="p-1 rounded border border-surface-container disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container-low cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={activeIndex >= totalInFilter - 1}
              className="p-1 rounded border border-surface-container disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container-low cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
