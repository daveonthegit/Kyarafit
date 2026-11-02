"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

/**
 * One time bucket in the planner's Daily view (Today / This week / Later).
 *
 * Collapsible groups animate their height + opacity (200ms ease-out) through a
 * `grid-template-rows` 0fr→1fr transition; the global reduced-motion rule in
 * globals.css collapses the duration so it snaps instantly. Collapsed content
 * is `inert` so hidden rows are not reachable by keyboard or screen readers.
 */
export function PlannerTaskGroup({
  title,
  count,
  collapsible = false,
  defaultOpen = true,
  showLabel,
  hideLabel,
  children,
}: {
  title: string;
  count: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  showLabel?: string;
  hideLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const bodyId = useId();
  const headingId = useId();
  const expanded = !collapsible || open;

  return (
    <section aria-labelledby={headingId} className="pb-2">
      <div className="flex min-h-[44px] items-center gap-3 px-2">
        <h3
          id={headingId}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70"
        >
          {title}
          <span className="ml-2 font-semibold tabular-nums text-media-fg-45">{count}</span>
        </h3>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55 transition-colors duration-150 ease-out hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            {open ? hideLabel : showLabel}
            <span
              aria-hidden="true"
              className={`inline-block transition-transform duration-200 ease-out motion-reduce:transition-none ${
                open ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>
        ) : null}
      </div>
      <div
        id={bodyId}
        inert={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
