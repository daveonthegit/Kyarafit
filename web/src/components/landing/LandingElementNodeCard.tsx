"use client";

import Link from "next/link";
import type { LandingNodePreview } from "@/data/landingMock";

/**
 * Same layout as {@link ../../app/elements/page} node cards — static preview for the marketing page.
 */
export function LandingElementNodeCard({
  node,
  href = "/auth/signup",
}: {
  node: LandingNodePreview;
  href?: string;
}) {
  const typeLabel = node.nodeType === "material" ? "Material" : "Element";

  return (
    <div className="group relative">
      <div
        className="pointer-events-none absolute right-3 top-3 z-20 h-5 w-5 rounded-full border border-white/30 bg-black/20"
        aria-hidden
      />
      <Link
        href={href}
        className="block overflow-hidden rounded-3xl border border-kyar-borderSubtle bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-lg"
        aria-label={`Preview: ${node.name}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-kyar-mutedWarm">
          {node.imageSrc ? (
            <img
              src={node.imageSrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-kyar-textTertiary">
              <span className="material-symbols-outlined text-5xl">
                {node.nodeType === "material" ? "science" : "checkroom"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-2">
            <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[9px] uppercase tracking-wider text-white backdrop-blur">
              {typeLabel}
            </span>
            <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[9px] uppercase tracking-wider text-white backdrop-blur">
              {node.statusLabel}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p className="mb-1 text-[9px] uppercase tracking-[0.2em] opacity-80">{node.category}</p>
            <h3 className="truncate font-serif text-3xl italic leading-none">{node.name}</h3>
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/80">
              <span>{node.progressPercent}% progress</span>
              <span>
                {node.childCount} child{node.childCount === 1 ? "" : "ren"}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
