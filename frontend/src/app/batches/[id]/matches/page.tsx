"use client";

import React, { useEffect, useState, useMemo, use } from "react";
import { Shell } from "@/components/layout/Shell";
import { MatchedRecordsHeader } from "@/components/matches/MatchedRecordsHeader";
import { MatchedRecordsToolbar } from "@/components/matches/MatchedRecordsToolbar";
import { MatchedRecordsTable } from "@/components/matches/MatchedRecordsTable";
import { fetchBatchMatches, fetchBatchSummary } from "@/lib/api";
import { MatchItem, BatchSummaryResponse } from "@/lib/types";
import { AlertCircle, Loader2 } from "lucide-react";

export default function MatchedRecordsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: batchId } = use(params);

  const [summary, setSummary] = useState<BatchSummaryResponse | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [subtypeFilter, setSubtypeFilter] = useState<string>("All Matches");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, matchesData] = await Promise.all([
          fetchBatchSummary(batchId),
          fetchBatchMatches(batchId),
        ]);
        setSummary(summaryData);
        setMatches(matchesData.matches);
      } catch (err: unknown) {
        console.error("Failed to load matched records:", err);
        const msg = err instanceof Error ? err.message : "Failed to load matched records";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [batchId]);

  const subtypeCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Matches": matches.length };
    for (const m of matches) {
      const key = m.match_subtype ?? "—";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (subtypeFilter !== "All Matches" && m.match_subtype !== subtypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          m.order_id.toLowerCase().includes(q) ||
          (m.bank_txn_id ?? "").toLowerCase().includes(q) ||
          (m.customer_ref ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [matches, subtypeFilter, searchQuery]);

  return (
    <Shell
      batchLabel={summary?.label}
      batchStatus={summary?.status}
      matchRatePct={summary?.match_rate_pct}
      exceptionCount={summary?.exception_count}
    >
      <div className="flex flex-col w-full max-w-7xl mx-auto space-y-4">
        <MatchedRecordsHeader
          batchId={batchId}
          batchLabel={summary?.label ?? batchId}
          totalOrders={summary?.total_orders ?? summary?.order_count}
          matches={matches}
        />

        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-error" />
            <div>
              <p className="font-semibold">Failed to fetch matched records</p>
              <p className="text-on-error-container/80">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-xs">Loading matched records...</p>
          </div>
        ) : (
          <>
            <MatchedRecordsToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              subtypeFilter={subtypeFilter}
              onSubtypeFilterChange={setSubtypeFilter}
              subtypeCounts={subtypeCounts}
            />
            <MatchedRecordsTable matches={filteredMatches} />
          </>
        )}
      </div>
    </Shell>
  );
}
