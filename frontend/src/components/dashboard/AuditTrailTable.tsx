"use client";

import React from "react";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { AuditTrailSummaryItem } from "@/lib/types";
import { formatINR, formatDateTime } from "@/lib/utils";

interface AuditTrailTableProps {
  entries: AuditTrailSummaryItem[];
  batchLabel: string;
  totalOrders: number;
  batchId?: string;
}

export function AuditTrailTable({
  entries,
  batchLabel,
  totalOrders,
  batchId,
}: AuditTrailTableProps) {
  // Decision badge styling helper
  const getDecisionBadge = (decisionType: string) => {
    switch (decisionType) {
      case "deterministic_match":
        return {
          bg: "bg-secondary-container/60 text-on-secondary-container",
          dot: "bg-secondary",
          label: "deterministic_match",
        };
      case "id_reference_match":
        return {
          bg: "bg-primary-fixed text-on-primary-fixed-variant",
          dot: "bg-primary",
          label: "id_reference_match",
        };
      case "llm_match":
        return {
          bg: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
          dot: "bg-tertiary",
          label: "llm_match",
        };
      case "exception_flag":
        return {
          bg: "bg-error-container text-on-error-container",
          dot: "bg-error",
          label: "exception_flag",
        };
      case "human_override":
        return {
          bg: "bg-surface-container-highest text-on-surface",
          dot: "bg-primary-container",
          label: "human_override",
        };
      default:
        return {
          bg: "bg-surface-container-high text-on-surface-variant",
          dot: "bg-outline",
          label: decisionType || "unassigned",
        };
    }
  };

  return (
    <div className="w-full bg-surface-container-lowest rounded-xl shadow-xs overflow-hidden flex flex-col border border-surface-container my-3">
      {/* Header */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest border-b border-surface-container">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-on-surface">
              Batch Audit Trail &amp; Decision Stream
            </h3>
            <span className="text-xs text-on-surface-variant">
              Settlement feed transactions with 4-stage pipeline algorithmic justifications (Auto-match threshold ≥0.75)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary-container/30 text-on-secondary-container rounded-full shrink-0 border border-secondary-container/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <span className="font-mono text-xs font-semibold text-secondary">
            Batch Synchronized
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-on-surface text-xs">
          <thead className="bg-surface-container-low font-semibold text-[11px] text-on-surface-variant uppercase tracking-wider border-b border-surface-container">
            <tr>
              <th className="py-2.5 px-4" scope="col">Event / Mode</th>
              <th className="py-2.5 px-4" scope="col">Entity Pair</th>
              <th className="py-2.5 px-4 text-right" scope="col">Settled Amount</th>
              <th className="py-2.5 px-4 text-center" scope="col">Confidence</th>
              <th className="py-2.5 px-4" scope="col">Model Reasoning &amp; Audit Trajectory</th>
              <th className="py-2.5 px-4 text-right" scope="col">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-sans">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-on-surface-variant font-mono">
                  No audit trail entries recorded yet for this batch.
                </td>
              </tr>
            ) : (
              entries.map((item) => {
                const badge = getDecisionBadge(item.decision_type);
                const isException = item.decision_type === "exception_flag";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-surface-container-low/60 transition-colors ${
                      isException ? "bg-error-container/10 hover:bg-error-container/20" : ""
                    }`}
                  >
                    {/* Event / Mode */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                        {badge.label}
                      </span>
                    </td>

                    {/* Entity Pair */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-primary font-medium">
                          #{item.order_id || "N/A"}
                        </span>
                        <span className="text-outline-variant">↔</span>
                        {item.txn_id ? (
                          <span className="text-on-surface font-medium">
                            #{item.txn_id}
                          </span>
                        ) : (
                          <span className="text-error font-semibold underline decoration-dashed">
                            Ambiguous
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Settled Amount */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono text-xs font-semibold currency-num text-on-surface">
                      <span className={isException ? "text-error" : "text-on-surface"}>
                        {formatINR(item.amount)}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-center">
                      {item.confidence !== undefined && item.confidence !== null ? (
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            item.confidence >= 0.9
                              ? "bg-secondary-container/50 text-secondary"
                              : item.confidence >= 0.75
                              ? "bg-primary-fixed text-primary"
                              : "bg-error-container text-on-error-container font-bold"
                          }`}
                        >
                          {item.confidence.toFixed(3)}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded">
                          Manual
                        </span>
                      )}
                    </td>

                    {/* Reasoning */}
                    <td className="py-2.5 px-4 max-w-md">
                      <p
                        className={`line-clamp-2 text-xs ${
                          isException ? "text-error font-medium" : "text-on-surface-variant"
                        }`}
                        title={item.reasoning || ""}
                      >
                        {item.reasoning || "—"}
                      </p>
                    </td>

                    {/* Time */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono text-[11px] text-on-surface-variant">
                      {formatDateTime(item.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 bg-surface-container-low/40 border-t border-surface-container flex items-center justify-between text-xs">
        <span className="font-mono text-on-surface-variant">
          Showing {entries.length} recent entries from {batchLabel} ({totalOrders} total orders)
        </span>
        <Link
          href={batchId ? `/batches/${batchId}/matches` : "/batches"}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All Transactions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
