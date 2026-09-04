"use client";

import React from "react";
import { Search, Download, ChevronDown } from "lucide-react";

interface BatchesToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
}

export function BatchesToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: BatchesToolbarProps) {
  return (
    <div className="bg-surface-container-lowest p-3 rounded-lg shadow-xs border border-surface-container flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 mb-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search settlement batch or ID..."
            className="w-full h-8 pl-8 pr-3 bg-surface-container-low/60 rounded text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-surface-container/60 transition-all font-sans"
          />
        </div>

        <div className="h-5 w-px bg-surface-container mx-1 hidden sm:block"></div>

        {/* Source Filter */}
        <div className="h-8 px-2.5 bg-surface-container-low text-on-surface rounded flex items-center gap-1 text-xs border border-surface-container/60">
          <span className="text-on-surface-variant">Source:</span>
          <span className="font-medium text-on-surface">Bank Feed</span>
        </div>

        {/* Status Filter */}
        <div className="relative flex items-center">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-8 pl-2.5 pr-7 bg-surface-container-low text-on-surface rounded text-xs border border-surface-container/60 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-sans appearance-none"
          >
            <option value="ALL">Status: All</option>
            <option value="completed">Status: Completed</option>
            <option value="running">Status: Running</option>
            <option value="pending">Status: Pending</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-outline absolute right-2 pointer-events-none" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 justify-end shrink-0">
        <button
          type="button"
          disabled
          title="Export CSV has no backend endpoint — disabled per specification"
          className="h-8 px-3 bg-surface-container-lowest text-on-surface-variant/50 rounded flex items-center gap-1.5 text-xs font-semibold border border-surface-container cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
}
