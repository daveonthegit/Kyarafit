"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { parseLocalDate } from "@kyarafit/design-system/domain";
import { addDaysToPlannerDate, plannerLocalDate } from "./groupPlannerTasks";

/**
 * Matches build Tasks tab / planner task row treatment.
 * Flat list row — no per-row card chrome; siblings separate with hairline
 * dividers and nesting reads through the left rail, not stacked borders.
 */
export const plannerWorkflowRowClassName =
  "flex flex-wrap items-start gap-2 rounded-[10px] px-2 py-3 min-h-[44px] hover:bg-glass-active transition-colors text-kyar-media-fg";

/**
 * Round task checkbox (ref 3b): light ring on glass, solid light + ink check when done.
 * `appearance-none` because the app ships no forms plugin; the visible circle is
 * 19px but the wrapping label gives a 44px hit area (QA-5).
 */
export const plannerWorkflowCheckboxClassName =
  "peer appearance-none rounded-full border-[1.5px] border-media-fg-55 bg-transparent w-[19px] h-[19px] min-w-[19px] cursor-pointer transition-[transform,background-color,border-color] duration-150 ease-out group-active:scale-90 hover:border-kyar-media-fg checked:bg-glass-solid checked:border-glass-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none";

const metaLinkClassName =
  "text-[10px] uppercase tracking-[0.14em] text-media-fg-55 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded";

const metaMutedClassName = "text-[10px] uppercase tracking-[0.14em] text-media-fg-55";

/** Trailing due label fallback ("Today" / "Tomorrow" / "Thu, Nov 5"), on local calendar days. */
export function formatPlannerWorkflowDueDate(dateStr: string): string {
  const day = dateStr.slice(0, 10);
  const today = plannerLocalDate();
  if (day === today) return "Today";
  if (day === addDaysToPlannerDate(today, 1)) return "Tomorrow";
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
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
    <label className="group relative -m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        className={plannerWorkflowCheckboxClassName}
        aria-label={ariaLabel}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute size-[11px] scale-50 text-glass-ink opacity-0 transition-[transform,opacity] duration-150 ease-out peer-checked:scale-100 peer-checked:opacity-100 motion-reduce:transition-none"
      >
        <path
          d="M2.5 6.2 5 8.6l4.5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
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
      className={`text-[13px] font-normal leading-5 transition-colors duration-150 ease-out ${done ? "line-through text-media-fg-55" : "text-kyar-media-fg"}`}
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
  return <span className="text-[11px] text-media-fg-55">{children}</span>;
}

/** Planner row (ref 3b): no wrapping, so the due date always trails the title column. */
const plannerTaskRowClassName =
  "flex items-start gap-2.5 rounded-[10px] px-2 py-3 min-h-[44px] hover:bg-glass-active transition-colors duration-150 ease-out text-kyar-media-fg";

/**
 * Planner list row with progressive disclosure (REQ-063 / DESIGN_SYSTEM.md §6).
 *
 * Default (collapsed) shows only the essentials: round checkbox, title, context
 * link and progress, with the due date (or a blocked chip) trailing. Advanced
 * fields (status, priority, dependencies) stay hidden until the per-row
 * "Details" disclosure is expanded.
 *
 * Checking a task flips the checkbox immediately (optimistic) and reconciles
 * once the `done` prop catches up; a rejected toggle reverts it.
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
  dueLabel,
  dueUrgent = false,
  statusChipLabel,
  blockedByCount,
  priority,
  blockedByTitles,
  dragHandleProps,
  dropIntoLabel,
}: {
  title: string;
  done: boolean;
  userId: string | null;
  onToggle: (next: boolean) => void | Promise<unknown>;
  contextHref: string;
  contextLabel: string;
  status: string;
  progressPercent: number;
  dueDate?: string;
  /** Pre-formatted (localized) trailing due label; falls back to formatting `dueDate`. */
  dueLabel?: string;
  /** Overdue or due today and still open — renders in the on-glass danger tone. */
  dueUrgent?: boolean;
  /** Short status chip shown up front (e.g. "Blocked"); replaces the trailing date. */
  statusChipLabel?: string;
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
  const t = useTranslations("Planner");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState<{ value: boolean; base: boolean } | null>(null);
  const detailsId = useId();
  if (pending && pending.base !== done) setPending(null);
  const shownDone = pending && pending.base === done ? pending.value : done;
  const statusLabel = t("taskStatusValue", { status });
  const hasPriority = typeof priority === "number" && priority > 0;
  const hasDependencies = Boolean(blockedByCount && blockedByCount > 0);
  const trailingDue = dueLabel ?? (dueDate ? formatPlannerWorkflowDueDate(dueDate) : undefined);

  const handleCheckedChange = (next: boolean) => {
    const request = { value: next, base: done };
    setPending(request);
    void Promise.resolve()
      .then(() => onToggle(next))
      .then(
        () => setPending((current) => (current === request ? null : current)),
        () => setPending((current) => (current === request ? null : current))
      );
  };

  return (
    <div
      className={`${plannerTaskRowClassName} ${
        dropIntoLabel ? "bg-glass-active ring-1 ring-inset ring-[var(--drop-into-ring)]" : ""
      }`}
    >
      {dragHandleProps ? (
        <div className="-my-3 flex h-11 shrink-0 items-center">
          {dragHandleProps.hasChildren ? (
            <button
              type="button"
              onClick={dragHandleProps.onToggleChildren}
              className="h-11 w-8 rounded-full text-xs text-media-fg-55 hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              aria-label={t(dragHandleProps.childrenOpen ? "collapseTask" : "expandTask")}
            >
              {dragHandleProps.childrenOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-8" aria-hidden="true" />
          )}
          <button
            type="button"
            onPointerDown={dragHandleProps.onPointerDown}
            className="h-11 w-8 touch-none cursor-grab rounded-full text-lg leading-none text-media-fg-45 hover:bg-glass-active hover:text-kyar-media-fg active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label={t("dragTask", { title })}
            title={t("dragTaskHint")}
          >
            ≡
          </button>
        </div>
      ) : null}
      <PlannerWorkflowCheckbox
        checked={shownDone}
        disabled={!userId}
        onCheckedChange={handleCheckedChange}
        ariaLabel={t(shownDone ? "markIncomplete" : "markComplete", { title })}
      />
      <div className="flex-1 min-w-0">
        <PlannerWorkflowTaskTitle done={shownDone}>{title}</PlannerWorkflowTaskTitle>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
          <PlannerWorkflowMetaLink href={contextHref}>{contextLabel}</PlannerWorkflowMetaLink>
          <PlannerWorkflowMetaMuted>· {progressPercent}%</PlannerWorkflowMetaMuted>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            aria-label={t(detailsOpen ? "hideDetails" : "showDetails", { title })}
            className="-my-3 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-45 hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span aria-hidden="true">{detailsOpen ? "▾" : "▸"}</span>
            {t(detailsOpen ? "less" : "details")}
          </button>
        </div>
        {detailsOpen ? (
          <dl
            id={detailsId}
            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-glass-divider pt-2"
          >
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[10px] uppercase tracking-[0.14em] text-media-fg-45">
                {t("taskStatusLabel")}
              </dt>
              <dd className="text-[10px] uppercase tracking-[0.14em] text-media-fg-70">
                {statusLabel}
              </dd>
            </div>
            {hasPriority ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-media-fg-45">
                  {t("taskPriorityLabel")}
                </dt>
                <dd className="text-[10px] uppercase tracking-[0.14em] text-media-fg-70">
                  {t("taskPriorityValue", { priority: priority ?? 0 })}
                </dd>
              </div>
            ) : null}
            {hasDependencies ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-media-fg-45">
                  {t("taskDependenciesLabel")}
                </dt>
                <dd className="text-[11px] text-on-glass-danger">
                  {blockedByTitles && blockedByTitles.length > 0
                    ? t("blockedByTitles", { titles: blockedByTitles.join(", ") })
                    : t("blockedByCount", { count: blockedByCount ?? 0 })}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {dropIntoLabel ? (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            {dropIntoLabel} ▸
          </p>
        ) : null}
      </div>
      {statusChipLabel && !shownDone ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-on-glass-chip-warn-bg px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-warn-fg">
          {statusChipLabel}
        </span>
      ) : trailingDue ? (
        <span
          className={`mt-[3px] shrink-0 text-[9px] uppercase tracking-[0.14em] tabular-nums ${
            dueUrgent && !shownDone
              ? "font-bold text-on-glass-danger"
              : "font-semibold text-media-fg-55"
          }`}
        >
          {trailingDue}
        </span>
      ) : null}
    </div>
  );
}
