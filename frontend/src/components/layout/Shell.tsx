"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  children: React.ReactNode;
  batchLabel?: string | null;
  batchStatus?: string | null;
  matchRatePct?: number | null;
  exceptionCount?: number | null;
  // The batch currently being viewed -- threaded into Sidebar so its nav
  // links carry ?batch= and switching screens doesn't lose context.
  activeBatchId?: string | null;
}

export function Shell({
  children,
  batchLabel,
  batchStatus,
  matchRatePct,
  exceptionCount,
  activeBatchId,
}: ShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar exceptionCount={exceptionCount} activeBatchId={activeBatchId} />
      <div className="pl-sidebar-width">
        <TopBar
          batchLabel={batchLabel}
          batchStatus={batchStatus}
          matchRatePct={matchRatePct}
        />
        <main className="w-full pt-14 px-6 pb-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
