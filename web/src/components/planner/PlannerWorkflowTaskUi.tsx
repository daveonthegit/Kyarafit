"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Matches build Tasks tab / planner task row treatment */
export const plannerWorkflowRowClassName =
  "flex flex-wrap items-start gap-3 border border-kyar-borderSubtle rounded-xl p-4 bg-kyar-surface shadow-sm min-h-[44px] hover:border-kyar-text transition-colors";

export const plannerWorkflowCheckboxClassName =
  "mt-1 rounded-full border-2 border-black bg-white w-6 h-6 min-w-[24px] min-h-[24px] focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 transition-transform active:scale-90 cursor-pointer checked:bg-black checked:border-black disabled:opacity-50 disabled:cursor-not-allowed";

const metaLinkClassName =
  "text-[11px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded";

const metaMutedClassName = "text-[11px] uppercase tracking-widest text-kyar-textTertiary";

const TODAY = () => new Date().toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatPlannerWorkflowDueDate(dateStr: string): string {
  const today = TODAY();
  const d = new Date(dateStr);
  if (dateStr === today) return "Today";
  const tomorrow = addDays(today, 1);
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export const WORKFLOW_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function PlannerWorkflowCheckbox({
  checked,
  disabled,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      className={plannerWorkflowCheckboxClassName}
      aria-label={ariaLabel}
    />
  );
}

export function PlannerWorkflowTaskTitle({
  children,
  done,
}: {
  children: ReactNode;
  done: boolean;
}) {
  return (
    <p
      className={`font-light tracking-tight ${done ? "line-through text-kyar-textTertiary" : "text-kyar-text"}`}
    >
      {children}
    </p>
  );
}

export function PlannerWorkflowMetaLine({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 mt-1">{children}</div>;
}

export function PlannerWorkflowMetaLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link href={href} className={metaLinkClassName} onClick={onClick}>
      {children}
    </Link>
  );
}

export function PlannerWorkflowMetaText({ children }: { children: ReactNode }) {
  return <span className={metaMutedClassName}>{children}</span>;
}

export function PlannerWorkflowMetaMuted({ children }: { children: ReactNode }) {
  return <span className="text-[11px] text-kyar-textTertiary">{children}</span>;
}

/** Planner list row: checkbox, title, context link, status, due date, progress */
export function PlannerTaskRow({
  title,
  done,
  userId,
  onToggle,
  contextHref,
  contextLabel,
  status,
  progressPercent,
  dueDate,
  blockedByCount,
}: {
  title: string;
  done: boolean;
  userId: string | null;
  onToggle: () => void;
  contextHref: string;
  contextLabel: string;
  status: string;
  progressPercent: number;
  dueDate?: string;
  blockedByCount?: number;
}) {
  return (
    <div className={plannerWorkflowRowClassName}>
      <PlannerWorkflowCheckbox
        checked={done}
        disabled={!userId}
        onCheckedChange={() => onToggle()}
        ariaLabel={`Mark "${title}" as ${done ? "incomplete" : "complete"}`}
      />
      <div className="flex-1 min-w-0">
        <PlannerWorkflowTaskTitle done={done}>{title}</PlannerWorkflowTaskTitle>
        <PlannerWorkflowMetaLine>
          <PlannerWorkflowMetaLink href={contextHref}>{contextLabel}</PlannerWorkflowMetaLink>
          <PlannerWorkflowMetaText>{status.split("_").join(" ")}</PlannerWorkflowMetaText>
          {dueDate ? (
            <PlannerWorkflowMetaMuted>
              · {formatPlannerWorkflowDueDate(dueDate)}
            </PlannerWorkflowMetaMuted>
          ) : null}
          <PlannerWorkflowMetaMuted>· {progressPercent}%</PlannerWorkflowMetaMuted>
          {blockedByCount ? (
            <span className="text-[11px] text-kyar-danger">· blocked by {blockedByCount}</span>
          ) : null}
        </PlannerWorkflowMetaLine>
      </div>
    </div>
  );
}
