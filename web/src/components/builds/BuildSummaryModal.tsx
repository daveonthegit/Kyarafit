"use client";

import { BuildSummarySection } from "./BuildSummarySection";
import type { BuildSummaryData } from "./BuildSummarySection";

export interface BuildSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summary: BuildSummaryData | null;
  formatCents: (cents: number) => string;
}

export function BuildSummaryModal({ open, onClose, summary, formatCents }: BuildSummaryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
    >
      <div className="bg-white max-w-lg w-full max-h-[85vh] flex flex-col rounded shadow-lg">
        <div className="flex items-center justify-between border-b border-kyar-border px-4 py-3 shrink-0">
          <h2 id="summary-modal-title" className="font-serif text-lg italic font-bold">
            Summary
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:opacity-70"
            aria-label="Close summary"
          >
            <span className="material-symbols-outlined font-light text-xl">close</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 p-4 overflow-auto">
          {summary ? (
            <BuildSummarySection summary={summary} formatCents={formatCents} />
          ) : (
            <p className="text-sm text-kyar-textTertiary">Loading summary…</p>
          )}
        </div>
      </div>
    </div>
  );
}
