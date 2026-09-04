"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { ExceptionQueueHeader, QUEUE_FILTERS } from "@/components/exceptions/ExceptionQueueHeader";
import { ExceptionReviewCard } from "@/components/exceptions/ExceptionReviewCard";
import { UpNextQueue } from "@/components/exceptions/UpNextQueue";
import { fetchBatchExceptions, fetchBatchSummary } from "@/lib/api";
import { ExceptionItem, BatchSummaryResponse } from "@/lib/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const DEFAULT_BATCH_ID = "9c75a7ac-b6ca-41fc-84b2-714b5204b20c";

function ExceptionsInner() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch") || DEFAULT_BATCH_ID;

  const [summary, setSummary] = useState<BatchSummaryResponse | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>(QUEUE_FILTERS[0]);
  const [activeReconId, setActiveReconId] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [lastResolution, setLastResolution] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, exceptionsData] = await Promise.all([
        fetchBatchSummary(batchId),
        fetchBatchExceptions(batchId),
      ]);
      setSummary(summaryData);
      setExceptions(exceptionsData.exceptions);
    } catch (err: unknown) {
      console.error("Failed to load exception queue:", err);
      const msg = err instanceof Error ? err.message : "Failed to load exception queue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((e) => {
      if (activeFilter === "Multiple Candidates") return e.review_candidates.length > 1;
      if (activeFilter === "Unknown Pattern") {
        return e.review_candidates.some((c) => !c.is_known_pattern);
      }
      return true;
    });
  }, [exceptions, activeFilter]);

  // Skipped items sink to the back of the queue instead of disappearing.
  const orderedQueue = useMemo(() => {
    const notSkipped = filteredExceptions.filter((e) => !skippedIds.has(e.reconciliation_id));
    const skipped = filteredExceptions.filter((e) => skippedIds.has(e.reconciliation_id));
    return [...notSkipped, ...skipped];
  }, [filteredExceptions, skippedIds]);

  const activeIndex = Math.max(
    0,
    orderedQueue.findIndex((e) => e.reconciliation_id === activeReconId)
  );
  const activeException = orderedQueue[activeIndex] ?? orderedQueue[0] ?? null;

  useEffect(() => {
    if (orderedQueue.length > 0 && !orderedQueue.some((e) => e.reconciliation_id === activeReconId)) {
      setActiveReconId(orderedQueue[0].reconciliation_id);
    }
  }, [orderedQueue, activeReconId]);

  const goTo = (idx: number) => {
    const item = orderedQueue[idx];
    if (item) setActiveReconId(item.reconciliation_id);
  };

  const handleResolved = (reconciliationId: string, outcome: string) => {
    setLastResolution(`${outcome === "matched" ? "Matched" : "Rejected"} — reconciliation_id ${reconciliationId}`);
    setExceptions((prev) => prev.filter((e) => e.reconciliation_id !== reconciliationId));
    setActiveReconId(null);
  };

  const handleSkip = () => {
    if (!activeException) return;
    setSkippedIds((prev) => new Set(prev).add(activeException.reconciliation_id));
    const nextIdx = (activeIndex + 1) % Math.max(orderedQueue.length, 1);
    goTo(nextIdx === activeIndex ? 0 : nextIdx);
  };

  const upNext = orderedQueue.filter((e) => e.reconciliation_id !== activeException?.reconciliation_id);

  return (
    <Shell
      batchLabel={summary?.label}
      batchStatus={summary?.status}
      matchRatePct={summary?.match_rate_pct}
      exceptionCount={summary?.exception_count}
    >
      <div className="flex flex-col w-full max-w-5xl mx-auto space-y-4 pb-8">
        <ExceptionQueueHeader
          batchId={batchId}
          batchLabel={summary?.label ?? batchId}
          exceptions={exceptions}
          activeFilter={activeFilter}
          onFilterChange={(f) => {
            setActiveFilter(f);
            setActiveReconId(null);
          }}
          activeIndex={activeIndex}
          totalInFilter={orderedQueue.length}
          onPrev={() => goTo(Math.max(0, activeIndex - 1))}
          onNext={() => goTo(Math.min(orderedQueue.length - 1, activeIndex + 1))}
        />

        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-error" />
            <div>
              <p className="font-semibold">Failed to fetch exception queue</p>
              <p className="text-on-error-container/80">{error}</p>
            </div>
          </div>
        )}

        {lastResolution && (
          <div className="p-3 rounded-xl bg-secondary-container text-on-secondary-container flex items-center gap-2.5 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{lastResolution}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-xs">Loading exception queue...</p>
          </div>
        ) : orderedQueue.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant bg-surface-container-lowest rounded-lg border border-surface-container">
            <CheckCircle2 className="w-10 h-10 text-secondary" />
            <p className="text-sm font-semibold text-on-surface">Queue clear</p>
            <p className="font-mono text-xs">No exceptions match the current filter.</p>
          </div>
        ) : (
          <>
            {activeException && (
              <ExceptionReviewCard
                key={activeException.reconciliation_id}
                batchId={batchId}
                exception={activeException}
                onResolved={handleResolved}
                onSkip={handleSkip}
              />
            )}
            <UpNextQueue items={upNext} onSelect={setActiveReconId} />
          </>
        )}
      </div>
    </Shell>
  );
}

export default function ExceptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ExceptionsInner />
    </Suspense>
  );
}
