"use client";

import React from "react";
import { ExceptionItem } from "@/lib/types";

interface UpNextQueueProps {
  items: ExceptionItem[];
  onSelect: (reconciliationId: string) => void;
}

function formatAmount(amount: number, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function UpNextQueue({ items, onSelect }: UpNextQueueProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Up Next in Queue ({items.length} remaining)
      </span>
      {items.map((item) => (
        <button
          key={item.reconciliation_id}
          type="button"
          onClick={() => onSelect(item.reconciliation_id)}
          className="flex items-center justify-between gap-3 bg-surface-container-lowest border border-surface-container rounded-lg px-4 py-3 text-left hover:bg-surface-container-low/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-semibold bg-surface-container-low px-2 py-0.5 rounded shrink-0">
              {item.order_id}
            </span>
            <span className="text-xs text-on-surface truncate">{item.customer_ref}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-xs text-on-surface">
              {formatAmount(item.amount, item.currency)}
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {item.review_candidates.length} candidate
              {item.review_candidates.length === 1 ? "" : "s"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
