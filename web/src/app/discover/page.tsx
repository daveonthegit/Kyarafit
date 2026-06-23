"use client";

import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { api } from "convex/_generated/api";

export default function DiscoverPage() {
  const builds = useQuery(api.builds.listDiscover, { limit: 50 });
  const isLoading = builds === undefined;

  return (
    <WebAppShell>
      <PageHeader title="Discover" subtitle="Public builds from the community" />
      <OnlineOnlyBanner className="mt-4" />

      <main className="mt-6 flex-1 pb-24 lg:pb-8">
        {isLoading ? (
          <EmptyState icon="hourglass_empty" message="Loading…" />
        ) : builds.length === 0 ? (
          <EmptyState
            icon="explore"
            message="No public builds yet."
            secondary="Builds shared publicly by the community will show up here."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builds.map((b) => (
              <li key={b._id}>
                <PublicBuildCard build={b} showOwner />
              </li>
            ))}
          </ul>
        )}
      </main>
    </WebAppShell>
  );
}
