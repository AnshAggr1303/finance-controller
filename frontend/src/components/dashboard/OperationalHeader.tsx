"use client";

import React from "react";
import { Calendar, SlidersHorizontal, Download, RefreshCw, PlayCircle, ChevronDown } from "lucide-react";
import { BatchListItem } from "@/lib/types";

interface OperationalHeaderProps {
  currentBatchId: string;
  currentBatchLabel: string;
  batchCreatedAt?: string;
  batchStatus?: string;
  batches?: BatchListItem[];
  onSelectBatch?: (id: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onRetrigger?: () => void;
  isRetriggering?: boolean;
}

export function OperationalHeader({
  currentBatchId,
  currentBatchLabel,
  batchCreatedAt,
  batchStatus,
  batches = [],
  onSelectBatch,
  onRefresh,
  isRefreshing = false,
  onRetrigger,
  isRetriggering = false,
}: OperationalHeaderProps) {
  const isCompleted = batchStatus === "completed";
  // Batch status isn't known until the summary fetch resolves — treat that
  // window as non-actionable too, not just "not completed", so the button
  // isn't briefly clickable before we know whether it should be disabled.
  const isRetriggerDisabled = !batchStatus || isCompleted || isRetriggering;
  // Format batch date or default
  const dateDisplay = batchCreatedAt
    ? new Date(batchCreatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + ` (${new Date(batchCreatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC)`
    : "May 18, 2025 (00:00–14:35 UTC)";

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 pb-2">
      {/* Title & Telemetry metadata */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Telemetry Node // Mumbai-East-1
          </span>
          <span className="text-outline-variant font-mono text-[10px]">•</span>
          <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
            SYS_EPOCH: 1747832
          </span>
        </div>
        <h1 className="text-2xl lg:text-[28px] font-semibold text-on-surface tracking-tight">
          Reconciliation Overview
        </h1>
        <p className="text-xs text-on-surface-variant">
          Real-time ledger vs. bank settlement telemetry and automated reconciliation pipeline
        </p>
      </div>

      {/* Filter Bar & Controls */}
      <div className="flex flex-wrap items-center gap-2 bg-surface-container-lowest p-1.5 rounded-xl shadow-xs border border-surface-container">
        {/* Date Context */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs">
          <Calendar className="w-3.5 h-3.5 text-tertiary" />
          <span className="font-mono font-medium">{dateDisplay}</span>
        </div>

        {/* Batch Selector */}
        <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5 text-tertiary" />
          <span className="text-on-surface-variant">Batch:</span>
          {batches.length > 1 ? (
            <select
              value={currentBatchId}
              onChange={(e) => onSelectBatch && onSelectBatch(e.target.value)}
              className="bg-transparent font-mono font-semibold text-primary cursor-pointer focus:outline-none pr-1"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id} className="text-on-surface bg-surface-container-lowest">
                  {b.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-mono font-semibold text-primary">
              {currentBatchLabel}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-outline-variant/30 mx-1 hidden sm:block"></div>

        {/* Export Button (Disabled per PROJECT_STATUS.md spec) */}
        <button
          type="button"
          disabled
          title="Export Audit Pack has no backend endpoint — disabled per specification"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Re-trigger Button — reruns the reconciliation pipeline via POST /batches/{id}/run */}
        <button
          type="button"
          onClick={onRetrigger}
          disabled={isRetriggerDisabled}
          title={
            !batchStatus
              ? "Loading batch status…"
              : isCompleted
              ? "Batch already completed — re-trigger disabled"
              : "Re-run the reconciliation pipeline for this batch"
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors shadow-xs text-xs font-semibold ${
            isRetriggerDisabled
              ? "bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed"
              : "bg-secondary text-on-secondary hover:bg-secondary-container cursor-pointer"
          }`}
        >
          <PlayCircle className={`w-3.5 h-3.5 ${isRetriggering ? "animate-spin" : ""}`} />
          <span>Re-trigger</span>
        </button>

        {/* Refresh Button — re-fetches the current batch summary via GET */}
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-xs text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
