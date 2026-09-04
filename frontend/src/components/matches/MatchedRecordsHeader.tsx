"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MatchItem } from "@/lib/types";

interface MatchedRecordsHeaderProps {
  batchId: string;
  batchLabel: string;
  totalOrders: number;
  matches: MatchItem[];
}

export function MatchedRecordsHeader({
  batchId,
  batchLabel,
  totalOrders,
  matches,
}: MatchedRecordsHeaderProps) {
  const matchedCount = matches.length;
  const automatedPct = totalOrders > 0 ? ((matchedCount / totalOrders) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col gap-4 mb-4 pt-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <Link href="/batches" className="hover:text-primary transition-colors">
          Batches
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/?batch=${batchId}`} className="hover:text-primary transition-colors font-mono">
          {batchLabel}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Matched Records</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Settlement Reconciled Ledger
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Every order/bank-row pair the pipeline auto-resolved for this batch
          </p>
        </div>

        {/* Stat Chips */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[110px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Total Orders
            </span>
            <span className="text-base font-semibold text-on-surface mt-1 font-mono">
              {totalOrders}
            </span>
          </div>
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[110px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Matched
            </span>
            <span className="text-base font-semibold text-secondary mt-1 font-mono">
              {matchedCount}
            </span>
          </div>
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[120px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Automated
            </span>
            <span className="text-base font-semibold text-primary mt-1 font-mono">
              {automatedPct}%
            </span>
          </div>
          <div className="bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-xs border border-surface-container flex flex-col min-w-[100px]">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Currency
            </span>
            <span className="text-base font-semibold text-on-surface mt-1 font-mono">
              INR (₹)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
