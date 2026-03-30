"use client";

import { useState } from "react";
import type { MockConvention } from "@/data/mockAccount";
import { mockBuildById } from "@/data/mockAccount";

/** Inner convention UI (hero + timeline + packing) — use inside {@link LandingMiniAppFrame} for landing scrolly. */
export function LandingMiniConventionDetailBody({
  convention,
  variant = "default",
}: {
  convention: MockConvention;
  /** Narrow stacked layout for the landing product carousel (avoids inner scrollbars). */
  variant?: "default" | "embedded";
}) {
  const [packRows, setPackRows] = useState(() =>
    convention.packingPreviewRows.map((r) => ({ ...r }))
  );
  const packedCount = packRows.filter((r) => r.done).length;

  const togglePacked = (label: string) => {
    setPackRows((prev) => prev.map((r) => (r.label === label ? { ...r, done: !r.done } : r)));
  };

  const embedded = variant === "embedded";

  return (
    <div
      className={
        embedded
          ? "flex min-w-0 flex-col gap-4 p-4 sm:p-5"
          : "grid gap-4 p-4 lg:grid-cols-[minmax(0,200px)_1fr] lg:gap-6 lg:p-6"
      }
    >
      <div
        className={
          embedded
            ? "relative aspect-video max-h-44 w-full shrink-0 overflow-hidden rounded-xl bg-kyar-muted shadow-soft"
            : "relative aspect-[3/4] overflow-hidden rounded-2xl bg-kyar-muted shadow-soft lg:sticky lg:top-4 lg:h-[min(360px,50vh)] lg:aspect-auto"
        }
      >
        <img src={convention.heroImageSrc} alt="" className="h-full w-full object-cover" />
        <div className="absolute bottom-3 left-3 rounded-sm bg-black px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-white">
          Event {convention.subtitle.replace(/\D/g, "").slice(0, 4) || "2026"}
        </div>
      </div>

      <div className={`min-w-0 ${embedded ? "space-y-4" : "space-y-6"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta">
            Starts soon
          </p>
          <p className="text-right text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-textTertiary">
            {convention.startDateLabel} – {convention.endDateLabel}
            {convention.location && (
              <>
                <br />
                {convention.location}
              </>
            )}
          </p>
        </div>

        <h3
          className={`font-serif font-normal italic leading-none tracking-tight ${
            embedded ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
          }`}
        >
          {convention.title}
        </h3>
        <p className="text-sm text-kyar-textSecondary">{convention.subtitle}</p>

        <div>
          <h4 className="mb-3 border-b border-kyar-borderSubtle pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text">
            Cosplay timeline
          </h4>
          <div className="space-y-4">
            {convention.days.map((d, idx) => {
              const build = mockBuildById(d.buildId);
              return (
                <div
                  key={`${d.dayLabel}-${d.dateLabel}`}
                  className={`flex gap-3 rounded-xl border border-kyar-borderSubtle bg-kyar-bgWarm ${
                    embedded ? "p-2.5" : "p-3"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-kyar-bg bg-black text-[10px] font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-kyar-textTertiary">
                      Day {idx + 1} · {d.dayLabel} · {d.dateLabel}
                    </p>
                    {build ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-12 w-10 shrink-0 overflow-hidden rounded-md border border-kyar-borderSubtle bg-white">
                          <img src={build.imageSrc} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-serif text-base italic text-kyar-text">
                            {build.name}
                          </p>
                          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-kyar-textSecondary">
                            {build.character}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-kyar-textTertiary">Unassigned</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-kyar-borderSubtle bg-kyar-bgWarm p-4">
          <div className="mb-3 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-kyar-accent">
            <span>Packing list</span>
            <span className="rounded-full bg-kyar-accent/10 px-2 py-0.5 text-kyar-text">
              {packedCount}/{convention.packingItems.length} packed
            </span>
          </div>
          <ul className="space-y-2">
            {packRows.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={() => togglePacked(row.label)}
                  className="flex w-full items-center gap-2 rounded-md text-left transition-colors hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-1"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      row.done ? "border-kyar-accent bg-kyar-accent" : "border-kyar-border bg-white"
                    }`}
                    aria-hidden
                  >
                    {row.done && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      row.done ? "text-kyar-textTertiary line-through" : "text-kyar-text"
                    }`}
                  >
                    {row.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Standalone card with window chrome (used when not embedded in app frame). */
export function LandingMiniConventionDetail({ convention }: { convention: MockConvention }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-white shadow-[0_24px_60px_rgba(0,0,0,0.06)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-kyar-borderSubtle bg-kyar-bgWarm px-3">
        <span className="h-2 w-2 rounded-full bg-[#FF5F56]" />
        <span className="h-2 w-2 rounded-full bg-[#FFBD2E]" />
        <span className="h-2 w-2 rounded-full bg-[#27C93F]" />
        <span className="material-symbols-outlined ml-1 text-sm text-kyar-textTertiary" aria-hidden>
          arrow_back
        </span>
        <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-kyar-textTertiary">
          Convention
        </span>
      </div>
      <LandingMiniConventionDetailBody convention={convention} />
    </div>
  );
}
