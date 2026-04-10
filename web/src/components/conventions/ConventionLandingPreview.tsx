"use client";

import { useCallback, useMemo, useState } from "react";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ConventionOutlineTree } from "@/components/conventions/ConventionOutlineTree";
import { ChecklistRow } from "@/components/ui/ChecklistRow";
import type { MockConvention } from "@/data/mockAccount";
import { mockBuildById } from "@/data/mockAccount";

/** ISO dates for mock convention (aligned with ECAF Mar 6–8, 2026). */
function mockIsoDates(convention: MockConvention): string[] {
  const base = ["2026-03-06", "2026-03-07", "2026-03-08"];
  return base.slice(0, convention.days.length);
}

/**
 * Read-only convention detail for the landing mini-app: same UI primitives as `/conventions/[id]`
 * ({@link ResolvedImage}, {@link ConventionOutlineTree}, {@link ChecklistRow}), stacked full-width.
 * Kept vertically compact so the landing scrolly section height stays near its intended min-height
 * (tall content was stretching the sticky block and throwing off scroll-step timing).
 */
export function ConventionLandingPreview({ convention }: { convention: MockConvention }) {
  const [packRows, setPackRows] = useState(() =>
    convention.packingPreviewRows.map((r) => ({ ...r }))
  );
  const [showOutline, setShowOutline] = useState(false);

  const isoDates = useMemo(() => mockIsoDates(convention), [convention]);

  const outlineDays = useMemo(
    () =>
      convention.days.map((d, i) => ({
        date: isoDates[i] ?? `2026-03-0${6 + i}`,
        buildName: mockBuildById(d.buildId)?.name ?? null,
      })),
    [convention.days, isoDates]
  );

  const handleOutlineSelect = useCallback((nodeId: string) => {
    if (nodeId === "logistics") {
      document.getElementById("landing-convention-logistics")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (nodeId.startsWith("day-")) {
      const date = nodeId.replace(/^day-/, "");
      document.getElementById(`landing-day-${date}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  const daysUntilStart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(isoDates[0] ?? "2026-03-06");
    startDate.setHours(0, 0, 0, 0);
    return Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [isoDates]);

  const eventYear = convention.subtitle.replace(/\D/g, "").slice(0, 4) || "2026";

  const packedCount = packRows.filter((r) => r.done).length;

  return (
    <div className="min-w-0">
      {/*
        Single-column stack for the landing mini-app frame: a 2-col “hero | rest” grid leaves the
        left track empty below the image while the right column stays narrow. Full-width sections
        use the panel better and match the real app’s reading order (hero → meta → timeline).
      */}
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div className="relative aspect-[21/9] w-full max-h-[min(140px,26vh)] overflow-hidden rounded-xl bg-kyar-muted shadow-soft sm:max-h-[min(160px,28vh)]">
          <ResolvedImage
            imageUrl={convention.heroImageSrc}
            alt={convention.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-3 left-3 rounded-sm bg-kyar-text px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-kyar-bg">
            EVENT {eventYear}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 pb-0 pt-0 sm:gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="max-w-[58%] text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta leading-relaxed">
              {daysUntilStart > 0
                ? `STARTS IN ${daysUntilStart} DAY${daysUntilStart === 1 ? "" : "S"}`
                : daysUntilStart === 0
                  ? "STARTS TODAY"
                  : `STARTED ${Math.abs(daysUntilStart)} DAY${Math.abs(daysUntilStart) === 1 ? "" : "S"} AGO`}
            </p>
            <p className="shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text leading-relaxed">
              {convention.startDateLabel} – {convention.endDateLabel}
              {convention.location && (
                <>
                  <br />
                  {convention.location}
                </>
              )}
            </p>
          </div>

          <h2 className="font-serif text-lg font-normal italic leading-tight tracking-tight sm:text-xl">
            {convention.title}
          </h2>
          <p className="text-xs leading-snug text-kyar-textSecondary sm:text-sm">
            {convention.subtitle}
          </p>

          <div className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft">
            <button
              type="button"
              onClick={() => setShowOutline((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset"
              aria-expanded={showOutline}
            >
              <span>Outline / Quick Jump</span>
              <span
                className={`material-symbols-outlined text-lg transition-transform ${showOutline ? "rotate-180" : ""}`}
              >
                expand_more
              </span>
            </button>
            {showOutline && (
              <div className="max-h-[min(160px,28vh)] overflow-y-auto overscroll-contain border-t border-kyar-borderSubtle p-2">
                <ConventionOutlineTree
                  conventionName={convention.title}
                  days={outlineDays}
                  onSelect={handleOutlineSelect}
                />
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 border-b border-kyar-borderSubtle pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text">
              Cosplay timeline
            </h3>
            {/* Landing: 3-column row keeps height in line with other mini-app slides; sticky section height tracks content. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
              {convention.days.map((d, idx) => {
                const date = isoDates[idx];
                const build = mockBuildById(d.buildId);
                return (
                  <div
                    key={`${d.dayLabel}-${d.dateLabel}`}
                    id={date ? `landing-day-${date}` : undefined}
                    className="scroll-mt-4 rounded-xl border border-kyar-borderSubtle bg-kyar-surface p-2 shadow-soft"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kyar-text text-[8px] font-bold text-kyar-bg">
                        {idx + 1}
                      </span>
                      <p className="min-w-0 text-[8px] font-bold uppercase leading-tight tracking-wide text-kyar-textTertiary">
                        {d.dayLabel} · {d.dateLabel}
                      </p>
                    </div>
                    {build ? (
                      <>
                        <div className="relative mb-1.5 h-16 w-full overflow-hidden rounded-lg border border-kyar-borderSubtle/80 bg-kyar-muted">
                          <ResolvedImage
                            imageUrl={build.imageSrc}
                            alt={build.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-kyar-meta">
                          {build.character}
                        </p>
                        <p className="line-clamp-2 break-words font-serif text-[11px] italic leading-snug text-kyar-text">
                          {build.name}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-kyar-textTertiary">Unassigned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div id="landing-convention-logistics" className="scroll-mt-3">
            <h3 className="mb-2 border-b border-kyar-borderSubtle pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text">
              Logistics &amp; packing
            </h3>
            <div className="rounded-xl border border-kyar-borderSubtle bg-kyar-surface p-3 shadow-soft">
              <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-kyar-accent">
                <span>Packing list</span>
                <span className="rounded-full bg-kyar-accent/10 px-2 py-0.5 text-kyar-text">
                  {packedCount}/{packRows.length} packed
                </span>
              </div>
              <ul className="max-h-[min(132px,22vh)] space-y-0 overflow-y-auto overscroll-contain pr-1">
                {packRows.map((row) => (
                  <li
                    key={row.label}
                    className="border-b border-kyar-borderSubtle/50 last:border-0"
                  >
                    <ChecklistRow
                      label={row.label}
                      checked={row.done}
                      onToggle={() =>
                        setPackRows((prev) =>
                          prev.map((r) => (r.label === row.label ? { ...r, done: !r.done } : r))
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
