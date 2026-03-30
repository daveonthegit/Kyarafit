"use client";

import type { MockConvention } from "@/data/mockAccount";
import type { MockBuild } from "@/data/mockAccount";

function mockIsoDates(convention: MockConvention): string[] {
  const base = ["2026-03-06", "2026-03-07", "2026-03-08"];
  return base.slice(0, convention.days.length);
}

export function ConventionLandingPreviewRemotion({
  convention,
  builds,
}: {
  convention: MockConvention;
  builds: MockBuild[];
}) {
  const isoDates = mockIsoDates(convention);
  const eventYear = convention.subtitle.replace(/\D/g, "").slice(0, 4) || "2026";
  const packedCount = convention.packingPreviewRows.filter((row) => row.done).length;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <div className="relative aspect-[21/9] w-full max-h-[min(140px,26vh)] overflow-hidden rounded-xl bg-kyar-muted shadow-soft sm:max-h-[min(160px,28vh)]">
          <img
            src={convention.heroImageSrc}
            alt={convention.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-3 left-3 rounded-sm bg-black px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white">
            EVENT {eventYear}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 pb-0 pt-0 sm:gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="max-w-[58%] text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta leading-relaxed">
              WEEKEND PLAN
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

          <div>
            <h3 className="mb-2 border-b border-kyar-borderSubtle pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text">
              Cosplay timeline
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
              {convention.days.map((day, idx) => {
                const date = isoDates[idx];
                const build = builds.find((candidate) => candidate.id === day.buildId);

                return (
                  <div
                    key={`${day.dayLabel}-${date}`}
                    className="rounded-xl border border-kyar-borderSubtle bg-kyar-surface p-2 shadow-soft"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <p className="min-w-0 text-[8px] font-bold uppercase leading-tight tracking-wide text-kyar-textTertiary">
                        {day.dayLabel} · {day.dateLabel}
                      </p>
                    </div>
                    {build ? (
                      <>
                        <div className="relative mb-1.5 h-16 w-full overflow-hidden rounded-lg border border-kyar-borderSubtle/80 bg-kyar-muted">
                          <img src={build.imageSrc} alt={build.name} className="h-full w-full object-cover" />
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

          <div>
            <h3 className="mb-2 border-b border-kyar-borderSubtle pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text">
              Logistics &amp; packing
            </h3>
            <div className="rounded-xl border border-kyar-borderSubtle bg-kyar-surface p-3 shadow-soft">
              <div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-kyar-accent">
                <span>Packing list</span>
                <span className="rounded-full bg-kyar-accent/10 px-2 py-0.5 text-kyar-text">
                  {packedCount}/{convention.packingPreviewRows.length} packed
                </span>
              </div>
              <ul className="space-y-0 pr-1">
                {convention.packingPreviewRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center gap-2 border-b border-kyar-borderSubtle/50 py-2 last:border-0"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                        row.done ? "border-kyar-accent bg-kyar-accent" : "border-kyar-border bg-white"
                      }`}
                    >
                      {row.done ? (
                        <svg
                          className="h-2.5 w-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </span>
                    <span
                      className={`text-[11px] font-semibold tracking-wide ${
                        row.done ? "text-kyar-textTertiary line-through" : "text-kyar-text"
                      }`}
                    >
                      {row.label}
                    </span>
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
