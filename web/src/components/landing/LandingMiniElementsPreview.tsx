"use client";

import { useMemo, useState } from "react";
import type { MockElementNode } from "@/data/mockAccount";
import { LandingMiniAppFrame } from "@/components/landing/LandingMiniAppFrame";

/** Inner Elements UI — use inside {@link LandingMiniAppFrame}. */
export function LandingMiniElementsPreviewContent({ nodes }: { nodes: MockElementNode[] }) {
  const categories = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.category))).sort(),
    [nodes]
  );
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      if (category && n.category !== category) return false;
      if (!q) return true;
      return n.name.toLowerCase().includes(q) || n.category.toLowerCase().includes(q);
    });
  }, [nodes, category, query]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-serif-elegant text-lg text-kyar-text">Elements</h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-1 ${
              category === null
                ? "border-kyar-text bg-kyar-text text-kyar-bg"
                : "border-kyar-borderSubtle bg-kyar-surface text-kyar-textSecondary hover:border-kyar-text/40"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-1 ${
                category === c
                  ? "border-kyar-text bg-kyar-text text-kyar-bg"
                  : "border-kyar-borderSubtle bg-kyar-surface text-kyar-textSecondary hover:border-kyar-text/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <label className="mb-3 block max-w-md">
        <span className="sr-only">Search elements</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements…"
          className="h-8 w-full rounded-md border border-kyar-borderSubtle bg-kyar-surface px-2 text-[10px] text-kyar-text placeholder:text-kyar-textMuted focus:border-kyar-accent focus:outline-none focus:ring-1 focus:ring-kyar-accent"
          autoComplete="off"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
        {filtered.map((node) => {
          const typeLabel = node.nodeType === "material" ? "Material" : "Element";
          return (
            <div
              key={node.id}
              className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-surface shadow-sm"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-kyar-mutedWarm">
                {node.imageSrc ? (
                  <img src={node.imageSrc} alt="" className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-kyar-media-scrim-heavy" />
                <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full border border-white/25 bg-black/40 px-1.5 py-0.5 text-[7px] uppercase tracking-wider text-kyar-media-fg backdrop-blur">
                    {typeLabel}
                  </span>
                  <span className="rounded-full border border-white/25 bg-black/40 px-1.5 py-0.5 text-[7px] uppercase tracking-wider text-kyar-media-fg backdrop-blur">
                    {node.statusLabel}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 text-kyar-media-fg">
                  <p className="mb-0.5 text-[7px] uppercase tracking-wider opacity-80">
                    {node.category}
                  </p>
                  <p className="truncate font-serif text-sm italic leading-tight drop-shadow-sm">
                    {node.name}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-center text-[10px] text-kyar-textTertiary">No elements match.</p>
      ) : null}
    </>
  );
}

export function LandingMiniElementsPreview({ nodes }: { nodes: MockElementNode[] }) {
  return (
    <LandingMiniAppFrame activeNav="elements">
      <LandingMiniElementsPreviewContent nodes={nodes} />
    </LandingMiniAppFrame>
  );
}
