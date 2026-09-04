"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Flag, ArrowRight } from "lucide-react";
import { BatchListItem } from "@/lib/types";

interface BatchesTableProps {
  batches: BatchListItem[];
  activeBatchId?: string;
}

export function BatchesTable({
  batches,
  activeBatchId = "9c75a7ac-b6ca-41fc-84b2-714b5204b20c",
}: BatchesTableProps) {
  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const hours = String(d.getUTCHours()).padStart(2, "0");
      const mins = String(d.getUTCMinutes()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${mins} UTC`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs overflow-hidden flex flex-col border border-surface-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px] text-xs">
          <thead>
            <tr className="bg-surface-container-low/70 text-on-surface-variant font-semibold text-[11px] uppercase tracking-wider h-9 border-b border-surface-container">
              <th className="py-2 px-4">Batch Label</th>
              <th className="py-2 px-3">Date / Time</th>
              <th className="py-2 px-3 text-right">Orders</th>
              <th className="py-2 px-3 min-w-[140px]">Match Rate</th>
              <th className="py-2 px-3">Exceptions</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-sans">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-on-surface-variant font-mono">
                  No batches match the current filter criteria.
                </td>
              </tr>
            ) : (
              batches.map((batch) => {
                const isActive = batch.id === activeBatchId;
                const isCompleted = batch.status === "completed";
                const isRunning = batch.status === "running";
                const hasExceptions = (batch.exception_count || 0) > 0;
                const ratePct = batch.match_rate_pct ?? (batch.match_rate ? batch.match_rate * 100 : 0);

                return (
                  <tr
                    key={batch.id}
                    className={`transition-colors group ${
                      isActive
                        ? "bg-primary-fixed/20 hover:bg-primary-fixed/30"
                        : "hover:bg-surface-container-low/40"
                    }`}
                  >
                    {/* Batch Label & Source */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {isActive && (
                          <span className="w-1.5 h-6 bg-primary rounded-full shrink-0"></span>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {batch.label}
                            </span>
                            {isActive && (
                              <span className="font-mono text-[9px] uppercase bg-primary-fixed text-on-primary-fixed-variant px-1.5 py-0.2 rounded font-semibold">
                                Live
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-on-surface-variant">
                            Bank Settlements Feed
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Date / Time */}
                    <td className="py-3 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                      {formatDate(batch.created_at)}
                    </td>

                    {/* Orders */}
                    <td className="py-3 px-3 font-mono text-xs text-right font-medium text-on-surface">
                      {batch.order_count}
                    </td>

                    {/* Match Rate Progress Bar */}
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span className={`font-semibold ${ratePct >= 90 ? "text-secondary" : "text-primary"}`}>
                            {ratePct.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            {ratePct >= 90 ? "Optimal" : "Target 95%"}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              ratePct >= 90 ? "bg-secondary" : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, ratePct))}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Exceptions */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {hasExceptions ? (
                        <span className="inline-flex items-center gap-1 bg-error-container text-on-error-container font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold">
                          <Flag className="w-3 h-3 text-error" />
                          <span>{batch.exception_count} pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant font-mono text-[10px] px-1.5 py-0.5 rounded">
                          0 pending
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant font-mono text-[10px] px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3 text-secondary" />
                          <span>Completed</span>
                        </span>
                      ) : isRunning ? (
                        <span className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container font-mono text-[10px] px-2 py-0.5 rounded-full font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                          <span>Running</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant font-mono text-[10px] px-2 py-0.5 rounded-full font-medium">
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/?batch=${batch.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container transition-colors cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-2.5 bg-surface-container-low/40 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-variant">
        <div>
          Showing <strong className="font-medium text-on-surface">1–{batches.length}</strong> of{" "}
          <strong className="font-medium text-on-surface">{batches.length}</strong> batches
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span className="h-6 w-6 rounded bg-primary text-on-primary font-semibold flex items-center justify-center">
            1
          </span>
        </div>
      </div>
    </div>
  );
}
