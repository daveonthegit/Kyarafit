"use client";

import { useMemo, useState } from "react";
import type { MockBuild } from "@/data/mockAccount";
import { LandingMiniAppFrame } from "@/components/landing/LandingMiniAppFrame";

type BuildTab = "all" | "idea" | "wip" | "ready";

const TABS: { id: BuildTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "idea", label: "Idea" },
  { id: "wip", label: "WIP" },
  { id: "ready", label: "Ready" },
];

function matchesTab(build: MockBuild, tab: BuildTab): boolean {
  if (tab === "all") return true;
  return build.status.toLowerCase() === tab;
}

/** Inner Builds UI — use inside {@link LandingMiniAppFrame} (e.g. product scrolly carousel). */
export function LandingMiniBuildsPreviewContent({ builds }: { builds: MockBuild[] }) {
  const [tab, setTab] = useState<BuildTab>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return builds.filter((b) => {
      if (!matchesTab(b, tab)) return false;
      if (!q) return true;
      const name = b.name.toLowerCase();
      const ch = (b.character ?? "").toLowerCase();
      return name.includes(q) || ch.includes(q);
    });
  }, [builds, tab, query]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-serif-elegant text-lg text-kyar-text">Builds</h3>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-1 ${
                tab === id
                  ? "border-kyar-text bg-kyar-text text-white"
                  : "border-kyar-borderSubtle bg-white text-kyar-textTertiary hover:border-kyar-text/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="mb-3 block max-w-md">
        <span className="sr-only">Search builds</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search builds…"
          className="h-8 w-full rounded-md border border-kyar-borderSubtle bg-white px-2 text-[10px] text-kyar-text placeholder:text-kyar-textTertiary focus:border-kyar-accent focus:outline-none focus:ring-1 focus:ring-kyar-accent"
          autoComplete="off"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {filtered.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden rounded-xl border border-kyar-borderSubtle bg-white shadow-sm"
          >
            <div className="relative aspect-[3/4] bg-kyar-muted">
              <img src={b.imageSrc} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-1 left-1 right-1">
                <p className="truncate font-serif text-[10px] italic text-white">{b.name}</p>
                <p className="truncate text-[8px] font-bold uppercase tracking-wider text-white/80">
                  {b.character}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-center text-[10px] text-kyar-textTertiary">No builds match.</p>
      ) : null}
    </>
  );
}

export function LandingMiniBuildsPreview({ builds }: { builds: MockBuild[] }) {
  return (
    <LandingMiniAppFrame activeNav="builds">
      <LandingMiniBuildsPreviewContent builds={builds} />
    </LandingMiniAppFrame>
  );
}
