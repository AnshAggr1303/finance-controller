"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight as ChevronRightIcon, CheckCircle2 } from "lucide-react";
import { MatchItem } from "@/lib/types";

interface MatchedRecordsTableProps {
  matches: MatchItem[];
}

const SUBTYPE_BADGE_CLASS: Record<string, string> = {
  exact: "bg-secondary-container text-on-secondary-container",
  "~2% fee": "bg-tertiary-container text-on-tertiary-container",
  rounding: "bg-tertiary-container text-on-tertiary-container",
  "ID Reference": "bg-primary text-on-primary",
  "Gemini LLM": "bg-primary-container text-on-primary-container",
  "Human Override": "bg-surface-container-high text-on-surface",
};

function formatAmount(amount?: number | null, currency = "INR") {
  if (amount == null) return "—";
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoString?: string | null) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return isoString;
  }
}

export function MatchedRecordsTable({ matches }: MatchedRecordsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs overflow-hidden flex flex-col border border-surface-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px] text-xs">
          <thead>
            <tr className="bg-surface-container-low/70 text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider h-9 border-b border-surface-container">
              <th className="py-2 px-4 w-6"></th>
              <th className="py-2 px-3">Order ID</th>
              <th className="py-2 px-3">Customer</th>
              <th className="py-2 px-3 text-right">Order Amt</th>
              <th className="py-2 px-3">Bank Txn Ref</th>
              <th className="py-2 px-3 text-right">Bank Amt</th>
              <th className="py-2 px-3">Match Type</th>
              <th className="py-2 px-3">Confidence</th>
              <th className="py-2 px-4">Reasoning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-sans">
            {matches.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-on-surface-variant font-mono">
                  No matched records for the current filter.
                </td>
              </tr>
            ) : (
              matches.map((m) => {
                const isExpanded = expandedId === m.reconciliation_id;
                const badgeClass =
                  SUBTYPE_BADGE_CLASS[m.match_subtype ?? ""] ??
                  "bg-surface-container-high text-on-surface-variant";

                return (
                  <React.Fragment key={m.reconciliation_id}>
                    <tr
                      className="hover:bg-surface-container-low/40 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : m.reconciliation_id)
                      }
                    >
                      <td className="py-3 px-4 text-on-surface-variant">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-primary">
                        {m.order_id}
                      </td>
                      <td className="py-3 px-3 text-on-surface">{m.customer_ref}</td>
                      <td className="py-3 px-3 text-right font-mono text-on-surface">
                        {formatAmount(m.order_amount, m.currency)}
                      </td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">
                        {m.bank_txn_id ?? "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-on-surface">
                        {formatAmount(m.bank_amount, m.currency)}
                        {m.delta != null && Math.abs(m.delta) > 0.001 && (
                          <div className="text-[10px] text-tertiary">
                            Δ {m.delta > 0 ? "+" : ""}
                            {m.delta.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}
                        >
                          {m.match_subtype ?? m.decision_type ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-14 bg-surface-container rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-secondary"
                              style={{ width: `${Math.round((m.confidence ?? 0) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            {m.confidence != null ? m.confidence.toFixed(3) : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant truncate max-w-[280px]">
                        {m.reasoning ?? "—"}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-surface-container-low/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-on-surface">
                            <CheckCircle2 className="w-4 h-4 text-secondary" />
                            <span>Audit Trail: {m.order_id}</span>
                            <span className="ml-auto font-mono text-[11px] text-on-surface-variant">
                              {formatDate(m.matched_at)}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            <span className="font-semibold text-primary">
                              {m.decision_type ?? "matcher"}:
                            </span>{" "}
                            {m.reasoning ?? "No reasoning recorded."}
                          </p>
                          {m.narration && (
                            <p className="text-[11px] text-on-surface-variant mt-1.5">
                              Bank narration: <span className="font-mono">&ldquo;{m.narration}&rdquo;</span>
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-surface-container-low/40 border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
        <span className="font-mono">Showing {matches.length} matched entries</span>
      </div>
    </div>
  );
}
