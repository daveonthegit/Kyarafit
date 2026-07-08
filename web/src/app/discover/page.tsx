"use client";

import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { api } from "convex/_generated/api";

export default function DiscoverPage() {
  const builds = useQuery(api.builds.listDiscover, { limit: 50 });
  const isLoading = builds === undefined;

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />

        <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-6">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-5">
            <h1 className="font-serif italic font-normal text-[34px] lg:text-[52px] tracking-[-0.02em]">
              Discover
            </h1>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-55">
              Public builds from the community
            </span>
          </div>

          <OnlineOnlyBanner surface="glass" className="mb-5" />

          <main className="flex-1">
            {isLoading ? (
              <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
            ) : builds.length === 0 ? (
              <EmptyState
                surface="glass"
                icon="explore"
                message="No public builds yet."
                secondary="Builds shared publicly by the community will show up here."
              />
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {builds.map((b) => (
                  <li key={b._id}>
                    <PublicBuildCard build={b} showOwner />
                  </li>
                ))}
              </ul>
            )}
          </main>
        </div>
      </div>
    </WebAppShell>
  );
}
