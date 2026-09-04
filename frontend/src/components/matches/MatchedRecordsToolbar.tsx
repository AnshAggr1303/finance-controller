"use client";

import React from "react";
import { Search } from "lucide-react";

export const SUBTYPE_FILTERS = [
  "All Matches",
  "exact",
  "~2% fee",
  "rounding",
  "ID Reference",
  "Gemini LLM",
  "Human Override",
] as const;

const SUBTYPE_LABELS: Record<string, string> = {
  "All Matches": "All Matches",
  exact: "Exact",
  "~2% fee": "~2% Fee",
  rounding: "Rounding",
  "ID Reference": "ID Reference",
  "Gemini LLM": "Gemini LLM",
  "Human Override": "Human Override",
};

interface MatchedRecordsToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  subtypeFilter: string;
  onSubtypeFilterChange: (s: string) => void;
  subtypeCounts: Record<string, number>;
}

export function MatchedRecordsToolbar({
  searchQuery,
  onSearchChange,
  subtypeFilter,
  onSubtypeFilterChange,
  subtypeCounts,
}: MatchedRecordsToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg shadow-xs border border-surface-container">
        <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Order ID (e.g. ORD-98421), Bank Txn, Customer..."
          className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
      </div>

      {/* Subtype Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {SUBTYPE_FILTERS.map((s) => {
          const count = s === "All Matches" ? subtypeCounts["All Matches"] ?? 0 : subtypeCounts[s] ?? 0;
          if (s !== "All Matches" && count === 0) return null;
          const isActive = subtypeFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSubtypeFilterChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? "bg-on-surface text-surface"
                  : "bg-surface-container-lowest text-on-surface-variant border border-surface-container hover:bg-surface-container-low"
              }`}
            >
              {SUBTYPE_LABELS[s] ?? s} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
