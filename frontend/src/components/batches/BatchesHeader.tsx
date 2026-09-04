"use client";

import React from "react";
import { BatchListItem } from "@/lib/types";

interface BatchesHeaderProps {
  batches: BatchListItem[];
}

export function BatchesHeader({ batches }: BatchesHeaderProps) {
  const activeCount = batches.filter((b) => b.status === "running").length;
  const totalExceptions = batches.reduce((acc, b) => acc + (b.exception_count || 0), 0);
  const avgMatchRate = batches.length > 0
    ? (batches.reduce((acc, b) => acc + (b.match_rate_pct || 0), 0) / batches.length).toFixed(1)
    : "0.0";

  return (
    <div className="flex flex-col gap-4 mb-4 pt-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        {/* Title & Tag */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider">
              Pipeline Orchestrator
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <span className="font-mono text-[11px] text-secondary font-medium">
              Auto-Sync On
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Settlement Batches
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Manage and inspect batch processing runs across merchant acquirers and bank gateways
          </p>
        </div>

        {/* Quick Summary Stats Chips */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {/* Active Batches */}
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[130px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Active Batches
            </span>
            <span className="text-base font-semibold text-primary mt-1">
              {activeCount > 0 ? `${activeCount} In Progress` : `${batches.length} Total`}
            </span>
          </div>

          {/* Exceptions Awaiting */}
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[140px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Exceptions Awaiting
            </span>
            <span className={`text-base font-semibold mt-1 ${totalExceptions > 0 ? "text-error" : "text-secondary"}`}>
              {totalExceptions} Pending
            </span>
          </div>

          {/* Avg Match Rate */}
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[130px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Avg Match Rate
            </span>
            <span className="text-base font-semibold text-secondary mt-1">
              {avgMatchRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
