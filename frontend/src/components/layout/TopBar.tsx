"use client";

import React from "react";
import { Search, Bell, Plus, User } from "lucide-react";
import { ReconLogo } from "../ReconLogo";

interface TopBarProps {
  // undefined/null on any of these means "not loaded yet" -- never
  // substitute a fake plausible label/status/rate for that. The label
  // shows an honest placeholder and the status chip is omitted entirely
  // when unknown, same principle as Sidebar's exception badge.
  batchLabel?: string | null;
  batchStatus?: string | null;
  matchRatePct?: number | null;
  onRunNewBatch?: () => void;
}

export function TopBar({
  batchLabel,
  batchStatus,
  matchRatePct,
  onRunNewBatch,
}: TopBarProps) {
  const hasStatus = typeof batchStatus === "string";
  const isCompleted = hasStatus && batchStatus.toLowerCase() === "completed";
  const hasRate = typeof matchRatePct === "number";

  return (
    <header className="fixed top-0 left-sidebar-width right-0 h-14 bg-surface-container-lowest/90 backdrop-blur-xl z-40 px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container">
      {/* Left Active Batch Info */}
      <div className="flex items-center gap-3">
        <ReconLogo size={24} className="w-6 h-6 rounded sm:hidden" />
        <span className="text-xs text-on-surface-variant font-medium hidden lg:inline">
          Active:
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-surface-container-low px-2.5 py-1 rounded text-on-surface font-medium border border-surface-container">
            {batchLabel ?? "—"}
          </span>
          {hasStatus &&
            (isCompleted ? (
              <span className="font-mono text-[11px] bg-secondary-container/60 text-on-secondary-container px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Synchronized{hasRate ? ` (${matchRatePct.toFixed(1)}%)` : ""}
              </span>
            ) : (
              <span className="font-mono text-[11px] bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                Processing{hasRate ? ` (${matchRatePct.toFixed(1)}%)` : ""}
              </span>
            ))}
        </div>
      </div>

      {/* Right Actions & Utilities */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 rounded-lg text-on-surface-variant border border-surface-container/60">
          <Search className="w-3.5 h-3.5 text-on-surface-variant" />
          <span className="text-xs hidden md:inline text-on-surface-variant/80">
            Search ledgers, entries...
          </span>
          <kbd className="font-mono text-[10px] bg-surface-container-lowest px-1.5 py-0.5 rounded text-on-surface-variant shadow-2xs border border-surface-container">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Run New Batch CTA */}
        <button
          type="button"
          onClick={onRunNewBatch}
          className="h-8 px-3 bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Run New Batch</span>
        </button>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-on-primary" />
        </div>
      </div>
    </header>
  );
}
