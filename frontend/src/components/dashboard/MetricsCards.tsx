"use client";

import React from "react";
import { Receipt, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface MetricsCardsProps {
  totalOrders: number;
  matchedCount: number;
  exceptionCount: number;
  rejectedCount: number;
  matchRatePct: number;
  totalSettledAmount: number;
}

export function MetricsCards({
  totalOrders,
  matchedCount,
  exceptionCount,
  rejectedCount,
  matchRatePct,
  totalSettledAmount,
}: MetricsCardsProps) {
  const exceptionRatePct = totalOrders > 0 ? (exceptionCount / totalOrders) * 100 : 0;
  const rejectedRatePct = totalOrders > 0 ? (rejectedCount / totalOrders) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 my-2">
      {/* 1. Total Batch Orders */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-4 rounded-xl shadow-xs flex flex-col justify-between border border-surface-container group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Total Batch Orders
            </span>
            <span className="text-2xl font-semibold text-on-surface tracking-tight">
              {totalOrders}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="pt-3 mt-2 flex flex-col gap-1 border-t border-surface-container-low">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-on-surface currency-num">
              {formatINR(totalSettledAmount)}
            </span>
            <span className="text-xs text-on-surface-variant">settled value</span>
          </div>
          <span className="font-mono text-[11px] text-on-surface-variant">
            Source: Bank Settlement Feed
          </span>
        </div>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40"></div>
      </div>

      {/* 2. Resolved Automatically */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-4 rounded-xl shadow-xs flex flex-col justify-between border border-surface-container group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
                Resolved Automatically
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            </div>
            <span className="text-2xl font-semibold text-on-surface tracking-tight">
              {matchedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container">
            <CheckCircle2 className="w-4 h-4 text-secondary" />
          </div>
        </div>
        <div className="pt-3 mt-2 flex flex-col gap-1.5 border-t border-surface-container-low">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono font-semibold text-secondary">
              {matchRatePct.toFixed(1)}% auto-reconciled
            </span>
            <span className="font-mono text-on-surface-variant">
              {matchedCount} / {totalOrders} orders
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, matchRatePct))}%` }}
            ></div>
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary"></div>
      </div>

      {/* 3. Pending Exceptions */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-4 rounded-xl shadow-xs flex flex-col justify-between border border-surface-container group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Pending Exceptions
              </span>
              {exceptionCount > 0 && (
                <span className="font-mono text-[10px] font-semibold bg-error-container text-on-error-container px-1.5 py-0.5 rounded">
                  Action Needed
                </span>
              )}
            </div>
            <span className="text-2xl font-semibold text-on-surface tracking-tight">
              {exceptionCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-error">
            <AlertTriangle className="w-4 h-4 text-error" />
          </div>
        </div>
        <div className="pt-3 mt-2 flex flex-col gap-1.5 border-t border-surface-container-low">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono font-medium text-error">
              {exceptionRatePct.toFixed(1)}% awaiting manual review
            </span>
            <span className="font-mono text-on-surface-variant">
              {exceptionCount} orders
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-error h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, exceptionRatePct))}%` }}
            ></div>
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-error"></div>
      </div>

      {/* 4. Rejected & Reversals */}
      <div className="relative overflow-hidden bg-surface-container-lowest p-4 rounded-xl shadow-xs flex flex-col justify-between border border-surface-container group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Rejected &amp; Reversals
            </span>
            <span className="text-2xl font-semibold text-on-surface tracking-tight">
              {rejectedCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-tertiary">
            <Ban className="w-4 h-4 text-tertiary" />
          </div>
        </div>
        <div className="pt-3 mt-2 flex flex-col gap-1.5 border-t border-surface-container-low">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono text-on-surface-variant">
              {rejectedRatePct.toFixed(1)}% manual write-offs
            </span>
            <span className="font-mono text-on-surface-variant currency-num">
              {formatINR(0)}
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-tertiary h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rejectedRatePct))}%` }}
            ></div>
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-outline-variant"></div>
      </div>
    </div>
  );
}
