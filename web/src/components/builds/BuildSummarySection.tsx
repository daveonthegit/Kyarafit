"use client";

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

  return (
    <div className="space-y-4" data-testid="build-summary-content">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
          Status
        </span>
        <span className="font-medium capitalize">{summary.status}</span>
      </div>
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
            Progress
          </span>
          <span className="text-xl font-bold">{summary.progressPercent}%</span>
        </div>
        <div className="h-[2px] bg-gray-200 w-full">
          <div
            className="h-full bg-black transition-all"
            style={{ width: `${summary.progressPercent}%` }}
            role="progressbar"
            aria-valuenow={summary.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Task completion progress"
          />
        </div>
        <p className="text-xs text-kyar-textTertiary mt-1">
          {summary.tasksChecked} of {summary.tasksTotal} tasks complete
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-1">
            Initial date
          </span>
          <p className="font-medium">{formatDate(summary.createdDate)}</p>
        </div>
        {summary.targetDate && (
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-1">
              Due date
            </span>
            <p className="font-medium">{formatDate(summary.targetDate)}</p>
          </div>
        )}
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-1">
            Elapsed
          </span>
          <p className="font-medium">
            {summary.elapsedDays} {summary.elapsedDays === 1 ? "day" : "days"}
          </p>
        </div>
        {summary.remainingDays !== null && (
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-1">
              Remaining
            </span>
            <p
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
            </p>
          </div>
        )}
      </div>
      <div>
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
          Linked items
        </span>
        <p className="text-sm font-medium">
          {summary.linkedItemsCompleteCount} of {summary.linkedItemCount} complete
        </p>
      </div>
      {summary.budgetCents != null && (
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
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
      )}
    </div>
  );
}
