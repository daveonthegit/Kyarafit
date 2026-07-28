"use client";

import { EditorialProgressDonut } from "./EditorialBuildProgress";

export interface BuildSummaryData {
  status: string;
  progressPercent: number;
  tasksChecked: number;
  tasksTotal: number;
  createdDate: string;
  targetDate: string | null;
  elapsedDays: number;
  remainingDays: number | null;
  linkedItemCount: number;
  linkedItemsCompleteCount: number;
  totalCostCents: number;
  budgetCents: number | null;
  budgetDifferenceCents: number | null;
}

export interface BuildSummarySectionProps {
  summary: BuildSummaryData | null;
  formatCents: (cents: number) => string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBuildStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "wip") return "In progress";
  if (normalized === "idea") return "Idea";
  if (normalized === "ready") return "Ready";
  if (normalized === "archived") return "Archived";
  return status;
}

export function BuildSummarySection({ summary, formatCents }: BuildSummarySectionProps) {
  if (!summary) return null;

  const budgetUsedPercent =
    summary.budgetCents && summary.budgetCents > 0
      ? Math.min(100, Math.round((summary.totalCostCents / summary.budgetCents) * 100))
      : null;

  return (
    <div className="space-y-8" data-testid="build-summary-content">
      <div className="grid gap-6 border-b border-glass-divider pb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55">
              Status
            </p>
            <p className="mt-3 font-serif italic text-3xl">
              {formatBuildStatus(summary.status)}
            </p>
          </div>
          <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55">
              Progress
            </p>
            <p className="mt-3 text-2xl font-semibold">{summary.progressPercent}%</p>
            <p className="mt-2 text-sm text-media-fg-70">
              {summary.tasksChecked} of {summary.tasksTotal} tasks complete
            </p>
          </div>
          <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55">
              Timeline
            </p>
            <div className="mt-3 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-media-fg-55">Started</span>
                <span className="font-medium">{formatDate(summary.createdDate)}</span>
              </div>
              {summary.targetDate ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-media-fg-55">Due</span>
                  <span className="font-medium">{formatDate(summary.targetDate)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-media-fg-55">Elapsed</span>
                <span className="font-medium">
                  {summary.elapsedDays} {summary.elapsedDays === 1 ? "day" : "days"}
                </span>
              </div>
              {summary.remainingDays !== null ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-media-fg-55">Remaining</span>
                  <span
                    className={`font-medium ${
                      summary.remainingDays < 0
                        ? "text-on-glass-danger"
                        : summary.remainingDays <= 7
                          ? "text-on-glass-chip-warn-fg"
                          : ""
                    }`}
                  >
                    {summary.remainingDays < 0
                      ? `${Math.abs(summary.remainingDays)} days overdue`
                      : summary.remainingDays === 0
                        ? "Due today"
                        : `${summary.remainingDays} days`}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55">
              Linked elements
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {summary.linkedItemsCompleteCount} / {summary.linkedItemCount}
            </p>
            <p className="mt-2 text-sm text-media-fg-70">Elements complete in this build</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[10px] border border-glass-border bg-glass-active px-4 py-5">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55 text-center">
              Build progress
            </p>
            <div className="mt-4 flex justify-center">
              <EditorialProgressDonut progress={summary.progressPercent} />
            </div>
          </div>
          {summary.budgetCents != null && budgetUsedPercent != null ? (
            <div className="rounded-[10px] border border-glass-border bg-glass-active px-4 py-5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55 text-center">
                Budget used
              </p>
              <div className="mt-4 flex justify-center">
                <EditorialProgressDonut progress={budgetUsedPercent} />
              </div>
              <p className="mt-3 text-center text-xs text-media-fg-55">
                {formatCents(summary.totalCostCents)} of {formatCents(summary.budgetCents)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      {summary.budgetCents != null ? (
        <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55 block mb-3">
            Budget
          </span>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total spend</span>
              <span className="font-medium">{formatCents(summary.totalCostCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Budget</span>
              <span className="font-medium">{formatCents(summary.budgetCents)}</span>
            </div>
            {summary.budgetDifferenceCents != null && (
              <div className="flex justify-between pt-2 border-t border-glass-divider">
                <span>Difference</span>
                <span
                  className={`font-medium ${
                    summary.budgetDifferenceCents < 0 ? "text-on-glass-danger" : ""
                  }`}
                >
                  {summary.budgetDifferenceCents >= 0 ? "+" : ""}
                  {formatCents(summary.budgetDifferenceCents)}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : summary.linkedItemCount > 0 ? (
        <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-media-fg-55 block mb-3">
            Linked elements cost
          </span>
          <div className="flex justify-between text-sm">
            <span>Total</span>
            <span className="font-medium">{formatCents(summary.totalCostCents)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
