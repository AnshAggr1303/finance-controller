"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { OperationalHeader } from "@/components/dashboard/OperationalHeader";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { PipelineArchitecture } from "@/components/dashboard/PipelineArchitecture";
import { AuditTrailTable } from "@/components/dashboard/AuditTrailTable";
import { fetchBatchSummary, fetchBatches, runBatch } from "@/lib/api";
import { BatchSummaryResponse, BatchListItem } from "@/lib/types";
import { AlertCircle, Loader2 } from "lucide-react";

// Ground-truth verified batch for frontend integration
const DEFAULT_BATCH_ID = "9c75a7ac-b6ca-41fc-84b2-714b5204b20c";

function DashboardInner() {
  const searchParams = useSearchParams();
  const queryBatchId = searchParams.get("batch");

  const [activeBatchId, setActiveBatchId] = useState<string>(queryBatchId || DEFAULT_BATCH_ID);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [summary, setSummary] = useState<BatchSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRetriggering, setIsRetriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if query param changes
  useEffect(() => {
    if (queryBatchId && queryBatchId !== activeBatchId) {
      setActiveBatchId(queryBatchId);
    }
  }, [queryBatchId, activeBatchId]);

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

  const handleRetrigger = async () => {
    if (summary?.status === "completed") return;
    setIsRetriggering(true);
    setError(null);
    try {
      await runBatch(activeBatchId);
      await loadData(activeBatchId, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger batch run";
      setError(msg);
    } finally {
      setIsRetriggering(false);
    }
  };

  const handleSelectBatch = (id: string) => {
    setActiveBatchId(id);
  };

  return (
    <Shell
      batchLabel={summary?.label}
      batchStatus={summary?.status}
      matchRatePct={summary?.match_rate_pct}
      exceptionCount={summary?.exception_count}
    >
      <div className="flex flex-col w-full max-w-7xl mx-auto space-y-4">
        {/* Operational Header with Epoch & Filter Bar */}
        <OperationalHeader
          currentBatchId={activeBatchId}
          currentBatchLabel={summary?.label}
          batchCreatedAt={summary?.created_at}
          batchStatus={summary?.status}
          batches={batches}
          onSelectBatch={handleSelectBatch}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onRetrigger={handleRetrigger}
          isRetriggering={isRetriggering}
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
              className="ml-auto underline font-semibold hover:opacity-80 cursor-pointer"
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
              batchId={activeBatchId}
            />
          </>
        )}
      </div>
    </Shell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
