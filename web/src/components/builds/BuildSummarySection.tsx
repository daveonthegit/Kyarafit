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

export function BuildSummarySection({ summary, formatCents }: BuildSummarySectionProps) {
  if (!summary) return null;

  const budgetUsedPercent =
    summary.budgetCents && summary.budgetCents > 0
      ? Math.min(100, Math.round((summary.totalCostCents / summary.budgetCents) * 100))
      : null;

  return (
    <div className="space-y-8" data-testid="build-summary-content">
      <div className="grid gap-6 border-b border-kyar-borderSubtle pb-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
              Status
            </p>
            <p className="mt-3 font-serif text-3xl capitalize text-kyar-text">{summary.status}</p>
          </div>
          <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
              Progress
            </p>
            <p className="mt-3 text-2xl font-semibold text-kyar-text">{summary.progressPercent}%</p>
            <p className="mt-2 text-sm text-kyar-textSecondary">
              {summary.tasksChecked} of {summary.tasksTotal} tasks complete
            </p>
          </div>
          <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
              Timeline
            </p>
            <div className="mt-3 grid gap-3 text-sm text-kyar-text">
              <div className="flex items-center justify-between gap-3">
                <span className="text-kyar-textTertiary">Started</span>
                <span className="font-medium">{formatDate(summary.createdDate)}</span>
              </div>
              {summary.targetDate ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-kyar-textTertiary">Due</span>
                  <span className="font-medium">{formatDate(summary.targetDate)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-kyar-textTertiary">Elapsed</span>
                <span className="font-medium">
                  {summary.elapsedDays} {summary.elapsedDays === 1 ? "day" : "days"}
                </span>
              </div>
              {summary.remainingDays !== null ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-kyar-textTertiary">Remaining</span>
                  <span
                    className={`font-medium ${
                      summary.remainingDays < 0
                        ? "text-red-600"
                        : summary.remainingDays <= 7
                          ? "text-orange-600"
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
          <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
              Linked items
            </p>
            <p className="mt-3 text-2xl font-semibold text-kyar-text">
              {summary.linkedItemsCompleteCount} / {summary.linkedItemCount}
            </p>
            <p className="mt-2 text-sm text-kyar-textSecondary">Complete in this build</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-4 py-5">
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary text-center">
              Build progress
            </p>
            <div className="mt-4 flex justify-center">
              <EditorialProgressDonut progress={summary.progressPercent} />
            </div>
          </div>
          {summary.budgetCents != null && budgetUsedPercent != null ? (
            <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-4 py-5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary text-center">
                Budget used
              </p>
              <div className="mt-4 flex justify-center">
                <EditorialProgressDonut progress={budgetUsedPercent} />
              </div>
              <p className="mt-3 text-center text-xs text-kyar-textTertiary">
                {formatCents(summary.totalCostCents)} of {formatCents(summary.budgetCents)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      {summary.budgetCents != null ? (
        <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-3">
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
              <div className="flex justify-between pt-2 border-t border-kyar-border">
                <span>Difference</span>
                <span
                  className={`font-medium ${
                    summary.budgetDifferenceCents < 0 ? "text-red-600" : ""
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
        <div className="rounded-[24px] border border-kyar-borderSubtle bg-white px-5 py-5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-3">
            Linked items cost
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
