"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

export default function FeedPage() {
  const { userId, isLoading: authLoading } = useCurrentUser();
  const builds = useQuery(
    api.builds.listFeedFromFollowing,
    userId ? { userId, limit: 50 } : "skip"
  );
  const isLoading = authLoading || (userId !== null && builds === undefined);

  return (
    <WebAppShell>
      <PageHeader title="Feed" subtitle="Public builds from people you follow" />

      <main className="mt-6 flex-1 pb-24 lg:pb-8">
        {isLoading ? (
          <EmptyState icon="hourglass_empty" message="Loading…" />
        ) : !userId ? (
          <EmptyState
            icon="group"
            message="Sign in to see builds from people you follow."
            action={
              <Link
                href="/auth/signin"
                className="min-h-[44px] inline-flex items-center rounded border border-kyar-text px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-kyar-text hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            }
          />
        ) : !builds || builds.length === 0 ? (
          <EmptyState
            icon="rss_feed"
            message="No builds yet from people you follow."
            secondary="Discover public builds and follow creators to fill your feed."
            action={
              <Link
                href="/discover"
                className="min-h-[44px] inline-flex items-center rounded border border-kyar-text px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-kyar-text hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                Discover builds
              </Link>
            }
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
