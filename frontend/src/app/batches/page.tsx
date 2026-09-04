"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Shell } from "@/components/layout/Shell";
import { BatchesHeader } from "@/components/batches/BatchesHeader";
import { BatchesToolbar } from "@/components/batches/BatchesToolbar";
import { BatchesTable } from "@/components/batches/BatchesTable";
import { fetchBatches } from "@/lib/api";
import { BatchListItem } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    async function loadBatches() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBatches();
        setBatches(data);
      } catch (err: unknown) {
        console.error("Failed to load batches:", err);
        const msg = err instanceof Error ? err.message : "Failed to load batches";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, []);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Status filter
      if (statusFilter !== "ALL" && b.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = b.label.toLowerCase().includes(q);
        const matchId = b.id.toLowerCase().includes(q);
        if (!matchLabel && !matchId) return false;
      }
      return true;
    });
  }, [batches, statusFilter, searchQuery]);

  return (
    <Shell>
      <div className="flex flex-col w-full max-w-7xl mx-auto space-y-4">
        {/* Header & Stats Chips */}
        <BatchesHeader batches={batches} />

        {/* Toolbar */}
        <BatchesToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-center gap-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-error" />
            <div>
              <p className="font-semibold">Failed to fetch batches from server</p>
              <p className="text-on-error-container/80">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-xs">Loading batches ledger from Supabase...</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <BatchesTable
            batches={filteredBatches}
            activeBatchId="9c75a7ac-b6ca-41fc-84b2-714b5204b20c"
          />
        )}
      </div>
    </Shell>
  );
}
