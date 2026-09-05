"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { ScorecardHeader } from "@/components/scorecard/ScorecardHeader";
import { ConfusionMatrix } from "@/components/scorecard/ConfusionMatrix";
import { ReconciliationParameters } from "@/components/scorecard/ReconciliationParameters";
import { DiscrepancyLog } from "@/components/scorecard/DiscrepancyLog";
import { fetchBatchScorecard, fetchBatchSummary } from "@/lib/api";
import { ScorecardResponse, BatchSummaryResponse } from "@/lib/types";
import { AlertCircle, Loader2 } from "lucide-react";

const DEFAULT_BATCH_ID = "9c75a7ac-b6ca-41fc-84b2-714b5204b20c";

function ScorecardInner() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch") || DEFAULT_BATCH_ID;

  const [summary, setSummary] = useState<BatchSummaryResponse | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, scorecardData] = await Promise.all([
        fetchBatchSummary(batchId),
        fetchBatchScorecard(batchId),
      ]);
      setSummary(summaryData);
      setScorecard(scorecardData);
    } catch (err: unknown) {
      console.error("Failed to load scorecard:", err);
      const msg = err instanceof Error ? err.message : "Failed to load scorecard";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Shell
      batchLabel={summary?.label}
      batchStatus={summary?.status}
      matchRatePct={summary?.match_rate_pct}
      exceptionCount={summary?.exception_count}
      activeBatchId={batchId}
    >
      <div className="flex flex-col w-full max-w-5xl mx-auto space-y-4 pb-8">
        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-3 text-xs font-medium mt-4">
            <AlertCircle className="w-5 h-5 shrink-0 text-error" />
            <div>
              <p className="font-semibold">Failed to fetch scorecard</p>
              <p className="text-on-error-container/80">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-xs">Scoring against true_match_id ground truth...</p>
          </div>
        ) : (
          scorecard && (
            <>
              <ScorecardHeader
                batchId={batchId}
                batchLabel={scorecard.label || batchId}
                data={scorecard}
              />
              <ConfusionMatrix data={scorecard} />
              <ReconciliationParameters data={scorecard} />
              <DiscrepancyLog data={scorecard} />
            </>
          )
        )}
      </div>
    </Shell>
  );
}

export default function ScorecardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ScorecardInner />
    </Suspense>
  );
}
