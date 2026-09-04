"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/layout/Shell";
import { OperationalHeader } from "@/components/dashboard/OperationalHeader";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { PipelineArchitecture } from "@/components/dashboard/PipelineArchitecture";
import { AuditTrailTable } from "@/components/dashboard/AuditTrailTable";
import { fetchBatchSummary, fetchBatches } from "@/lib/api";
import { BatchSummaryResponse, BatchListItem } from "@/lib/types";
import { AlertCircle, Loader2 } from "lucide-react";

// Ground-truth verified batch for frontend integration
const DEFAULT_BATCH_ID = "9c75a7ac-b6ca-41fc-84b2-714b5204b20c";

export default function DashboardPage() {
  const [activeBatchId, setActiveBatchId] = useState<string>(DEFAULT_BATCH_ID);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [summary, setSummary] = useState<BatchSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load batch summary
  const loadData = useCallback(async (batchId: string, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const summaryData = await fetchBatchSummary(batchId);
      setSummary(summaryData);

      // Lazily populate batch selector options in background if not already loaded
      if (batches.length === 0) {
        fetchBatches()
          .then((bList) => {
            if (bList && bList.length > 0) setBatches(bList);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      console.error("Failed to load dashboard data:", err);
      const msg = err instanceof Error ? err.message : "Failed to load batch summary";
      setError(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [batches.length]);

  useEffect(() => {
    loadData(activeBatchId);
  }, [activeBatchId, loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(activeBatchId, false);
  };

  const handleSelectBatch = (id: string) => {
    setActiveBatchId(id);
  };

  return (
    <Shell
      batchLabel={summary?.label || "frontend-integration-test"}
      batchStatus={summary?.status || "completed"}
      matchRatePct={summary?.match_rate_pct ?? 70.0}
      exceptionCount={summary?.exception_count ?? 15}
    >
      <div className="flex flex-col w-full max-w-7xl mx-auto space-y-4">
        {/* Operational Header with Epoch & Filter Bar */}
        <OperationalHeader
          currentBatchId={activeBatchId}
          currentBatchLabel={summary?.label || "frontend-integration-test"}
          batchCreatedAt={summary?.created_at}
          batches={batches}
          onSelectBatch={handleSelectBatch}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-error" />
            <div>
              <p className="font-semibold">Failed to fetch live batch data</p>
              <p className="text-on-error-container/80">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="ml-auto underline font-semibold hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton / Spinner */}
        {loading && !summary && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-xs">Loading batch telemetry from reconciliation engine...</p>
          </div>
        )}

        {/* Dashboard Content */}
        {summary && (
          <>
            {/* Top Metrics Grid (4 Cards) */}
            <MetricsCards
              totalOrders={summary.total_orders ?? summary.order_count ?? 0}
              matchedCount={summary.matched_count}
              exceptionCount={summary.exception_count}
              rejectedCount={summary.rejected_count}
              matchRatePct={summary.match_rate_pct}
              totalSettledAmount={summary.total_settled_amount}
            />

            {/* Composite Performance & AI Model Intelligence Card */}
            <PipelineArchitecture
              totalOrders={summary.total_orders ?? summary.order_count ?? 0}
              deterministicCount={summary.pipeline_breakdown?.deterministic_match ?? 0}
              regexCount={summary.pipeline_breakdown?.id_reference_match ?? 0}
              llmCount={summary.pipeline_breakdown?.llm_match ?? 0}
              humanReviewCount={summary.pipeline_breakdown?.exception_flag ?? 0}
              rejectedCount={summary.rejected_count}
            />

            {/* Batch Audit Trail & Decision Stream */}
            <AuditTrailTable
              entries={summary.recent_audit_trail || []}
              batchLabel={summary.label}
              totalOrders={summary.total_orders ?? summary.order_count ?? 0}
            />
          </>
        )}
      </div>
    </Shell>
  );
}
