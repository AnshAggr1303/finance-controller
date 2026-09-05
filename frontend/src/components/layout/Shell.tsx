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
  onRunNewBatch?: () => void;
}

export function Shell({
  children,
  batchLabel,
  batchStatus,
  matchRatePct,
  exceptionCount,
  onRunNewBatch,
}: ShellProps) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Sidebar exceptionCount={exceptionCount} />
      <div className="pl-sidebar-width">
        <TopBar
          batchLabel={batchLabel}
          batchStatus={batchStatus}
          matchRatePct={matchRatePct}
          onRunNewBatch={onRunNewBatch}
        />
        <main className="w-full pt-14 px-6 pb-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
