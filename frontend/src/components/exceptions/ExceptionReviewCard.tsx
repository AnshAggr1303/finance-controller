"use client";

import React, { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { ExceptionItem, CandidateItem } from "@/lib/types";
import { submitReviewDecision, ApiError } from "@/lib/api";

interface ExceptionReviewCardProps {
  batchId: string;
  exception: ExceptionItem;
  onResolved: (reconciliationId: string, outcome: string) => void;
  onSkip: () => void;
}

function formatAmount(amount: number, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PATTERN_BADGE_CLASS: Record<string, string> = {
  exact: "bg-secondary-container text-on-secondary-container",
  "~2% fee": "bg-tertiary-container text-on-tertiary-container",
  rounding: "bg-tertiary-container text-on-tertiary-container",
};

export function ExceptionReviewCard({
  batchId,
  exception,
  onResolved,
  onSkip,
}: ExceptionReviewCardProps) {
  // Candidate index (1-based, matches CandidateItem.index) currently showing
  // the "confirm unknown pattern" warning — null when no warning is pending.
  const [pendingWarningIndex, setPendingWarningIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: string, confirmUnknown: boolean, candidate?: CandidateItem) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitReviewDecision(
        batchId,
        exception.reconciliation_id,
        decision,
        confirmUnknown
      );
      setPendingWarningIndex(null);
      onResolved(exception.reconciliation_id, res.status);
    } catch (err: unknown) {
      // Defense-in-depth: even if a candidate's client-side is_known_pattern
      // flag were ever stale, the backend re-checks and returns this same
      // 400 — fall back to the warning gate instead of just erroring out.
      if (err instanceof ApiError && err.status === 400 && candidate) {
        setPendingWarningIndex(candidate.index);
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to submit review decision";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = (candidate: CandidateItem) => {
    setError(null);
    if (candidate.is_known_pattern) {
      submit(String(candidate.index), false, candidate);
    } else {
      setPendingWarningIndex(candidate.index);
    }
  };

  const handleConfirmOverride = (candidate: CandidateItem) => {
    submit(String(candidate.index), true, candidate);
  };

  const handleReject = () => {
    setError(null);
    submit("no", false);
  };

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-xs border border-surface-container overflow-hidden">
      {/* Order Header */}
      <div className="flex items-start justify-between p-5 border-b border-surface-container">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold bg-surface-container-low px-2 py-0.5 rounded">
              {exception.order_id}
            </span>
            {exception.review_candidates.length === 0 && (
              <span className="inline-flex items-center gap-1 bg-error-container text-on-error-container font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full">
                NO CANDIDATES
              </span>
            )}
          </div>
          <span className="text-base font-semibold text-on-surface">{exception.customer_ref}</span>
          <span className="text-[11px] text-on-surface-variant">
            Source: Internal Order Ledger
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Booked Order Value
          </span>
          <span className="block text-2xl font-semibold text-on-surface font-mono mt-1">
            {formatAmount(exception.amount, exception.currency)}
          </span>
        </div>
      </div>

      {/* AI Reason */}
      {exception.flag_reason && (
        <div className="mx-5 mt-4 bg-primary-fixed/10 border border-primary-fixed/30 rounded-lg p-3.5 flex gap-3">
          <Bot className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-on-surface">Node 5 Reasoning</span>
              {exception.flag_confidence != null && (
                <span className="font-mono text-[10px] text-on-surface-variant">
                  Confidence: {exception.flag_confidence.toFixed(2)} &lt; 0.75 threshold
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">{exception.flag_reason}</p>
          </div>
        </div>
      )}

      {/* Candidates */}
      <div className="px-5 pt-4 pb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <span>
          Candidate Bank Rows ({exception.review_candidates.length} detected) — select correct
          entry to reconcile
        </span>
      </div>

      <div className="px-5 pb-4 flex flex-col gap-2.5 mt-1">
        {exception.review_candidates.map((c) => {
          const badgeClass =
            PATTERN_BADGE_CLASS[c.pattern_label] ?? "bg-error-container text-on-error-container";
          const isPendingWarning = pendingWarningIndex === c.index;

          return (
            <div key={c.id} className="flex flex-col">
              <div className="flex items-center justify-between gap-3 bg-surface-container-low/40 border border-surface-container rounded-lg px-4 py-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-on-surface">
                      {c.txn_id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}
                    >
                      {!c.is_known_pattern && <AlertTriangle className="w-2.5 h-2.5" />}
                      {c.pattern_label}
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant truncate">
                    &ldquo;{c.narration}&rdquo;
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold text-on-surface">
                    {formatAmount(c.amount, c.currency)}
                  </div>
                  <div
                    className={`font-mono text-[10px] ${
                      c.is_known_pattern ? "text-secondary" : "text-error"
                    }`}
                  >
                    Δ {c.delta > 0 ? "+" : ""}
                    {c.delta.toFixed(2)}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSelect(c)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Select
                </button>
              </div>

              {isPendingWarning && (
                <div className="mt-1.5 bg-tertiary-fixed/15 border border-tertiary/40 rounded-lg p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-on-surface">
                        Confirmation Required: Non-Standard Ledger Event
                      </span>
                      <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                        This transaction delta ({c.delta > 0 ? "+" : ""}
                        {c.delta.toFixed(2)}) doesn&apos;t match a known reconciliation pattern
                        (exact, ~2% fee, or ≤₹1 rounding). Confirm anyway?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-6.5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleConfirmOverride(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-on-surface text-surface text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Confirm Override &amp; Match
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPendingWarningIndex(null)}
                      className="text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-on-surface-variant ml-auto">
                      Audit log will record this as{" "}
                      <span className="font-mono">human_override</span>.
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mx-5 mb-4 bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-container bg-surface-container-low/30">
        <button
          type="button"
          disabled={submitting}
          onClick={handleReject}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-error/40 text-error text-xs font-semibold hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          None of these — Reject &amp; Flag for Dispute
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSkip}
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer disabled:opacity-50"
        >
          Skip for Later
        </button>
      </div>
    </div>
  );
}
