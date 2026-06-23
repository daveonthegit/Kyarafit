"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * Matches build Tasks tab / planner task row treatment.
 * Flat list row — no per-row card chrome; siblings separate with hairline
 * dividers and nesting reads through the left rail, not stacked borders.
 */
export const plannerWorkflowRowClassName =
  "flex flex-wrap items-start gap-2 rounded-lg px-2 py-3 min-h-[44px] hover:bg-kyar-mutedWarm/70 transition-colors";

export const plannerWorkflowCheckboxClassName =
  "mt-1 rounded-full border-2 border-kyar-border bg-kyar-surface w-6 h-6 min-w-[24px] min-h-[24px] accent-kyar-accent focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 transition-transform active:scale-90 cursor-pointer checked:bg-kyar-text checked:border-kyar-text disabled:opacity-50 disabled:cursor-not-allowed";

const metaLinkClassName =
  "text-[11px] uppercase tracking-wide text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded";

const metaMutedClassName = "text-[11px] uppercase tracking-wide text-kyar-textTertiary";

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

/**
 * Planner list row with progressive disclosure (REQ-063 / DESIGN_SYSTEM.md §6).
 *
 * Default (collapsed) shows only the essentials: checkbox, title, context link,
 * due date and progress. Advanced fields (status, priority, dependencies) stay
 * hidden until the per-row "Details" disclosure is expanded.
 */
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
  priority,
  blockedByTitles,
  dragHandleProps,
  dropIntoLabel,
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
  priority?: number;
  blockedByTitles?: string[];
  dragHandleProps?: {
    hasChildren: boolean;
    childrenOpen: boolean;
    onToggleChildren: () => void;
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  };
  dropIntoLabel?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const statusLabel = status.split("_").join(" ");
  const hasPriority = typeof priority === "number" && priority > 0;
  const hasDependencies = Boolean(blockedByCount && blockedByCount > 0);

  return (
    <div
      className={`${plannerWorkflowRowClassName} ${
        dropIntoLabel ? "bg-kyar-muted ring-1 ring-inset ring-kyar-text" : ""
      }`}
    >
      <div className="flex min-h-[32px] items-center gap-1">
        {dragHandleProps?.hasChildren ? (
          <button
            type="button"
            onClick={dragHandleProps.onToggleChildren}
            className="min-h-[32px] min-w-[32px] rounded-full text-xs text-kyar-meta hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label={dragHandleProps.childrenOpen ? "Collapse task" : "Expand task"}
          >
            {dragHandleProps.childrenOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="min-h-[32px] min-w-[32px]" aria-hidden="true" />
        )}
        {dragHandleProps ? (
          <button
            type="button"
            onPointerDown={dragHandleProps.onPointerDown}
            className="touch-none min-h-[32px] min-w-[32px] cursor-grab rounded-full text-lg leading-none text-kyar-meta hover:bg-kyar-mutedWarm active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label={`Drag "${title}"`}
            title="Drag to reorder, nest, or promote"
          >
            ≡
          </button>
        ) : null}
      </div>
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
          {dueDate ? (
            <PlannerWorkflowMetaMuted>
              · {formatPlannerWorkflowDueDate(dueDate)}
            </PlannerWorkflowMetaMuted>
          ) : null}
          <PlannerWorkflowMetaMuted>· {progressPercent}%</PlannerWorkflowMetaMuted>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            aria-label={detailsOpen ? `Hide details for "${title}"` : `Show details for "${title}"`}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[10px] font-bold uppercase tracking-widest text-kyar-meta hover:bg-kyar-mutedWarm hover:text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="transition-transform">
              {detailsOpen ? "▾" : "▸"}
            </span>
            {detailsOpen ? "Less" : "Details"}
          </button>
        </PlannerWorkflowMetaLine>
        {detailsOpen ? (
          <dl
            id={detailsId}
            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-kyar-borderSubtle/60 pt-2"
          >
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">Status</dt>
              <dd className="text-[11px] uppercase tracking-wide text-kyar-meta">{statusLabel}</dd>
            </div>
            {hasPriority ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                  Priority
                </dt>
                <dd className="text-[11px] uppercase tracking-wide text-kyar-meta">{priority}</dd>
              </div>
            ) : null}
            {hasDependencies ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                  Dependencies
                </dt>
                <dd className="text-[11px] text-kyar-danger">
                  {blockedByTitles && blockedByTitles.length > 0
                    ? `blocked by ${blockedByTitles.join(", ")}`
                    : `blocked by ${blockedByCount}`}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {dropIntoLabel ? (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-kyar-meta">
            {dropIntoLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
