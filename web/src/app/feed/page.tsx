"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

export default function FeedPage() {
  const { userId, isLoading: authLoading } = useCurrentUser();
  const builds = useQuery(
    api.builds.listFeedFromFollowing,
    userId ? { userId, limit: 50 } : "skip"
  );
  const isLoading = authLoading || (userId !== null && builds === undefined);

  // The featured item is the most recent from the same query that fills the shelf (12a).
  const featured = builds?.[0];
  const featuredOwner = featured
    ? featured.ownerUsername
      ? `@${featured.ownerUsername}`
      : (featured.ownerName ?? null)
    : null;

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop imageStorageId={featured?.imageStorageId} imageUrl={featured?.imageUrl} />

        <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-12 pb-6 min-h-0">
          {/* Latest from people you follow (12a) */}
          <section className="flex-1 min-w-0 max-w-[680px] lg:mt-4">
            {featured ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  Latest from people you follow
                  {featured.character ? ` · ${featured.character}` : ""}
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[80px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  {featured.name}
                </h1>
                {featuredOwner && (
                  <span className="mt-4 inline-flex items-center rounded-full bg-on-glass-chip-neutral-bg px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-neutral-fg backdrop-blur-glass-chip">
                    {featuredOwner}
                  </span>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/b/${featured._id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    View build
                  </Link>
                  <Link
                    href="/discover"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border-strong bg-glass-bar px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Discover
                  </Link>
                </div>
              </>
            ) : !isLoading ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  The feed
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[64px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  Nothing here yet.
                </h1>
              </>
            ) : null}
          </section>

          {/* The feed — bottom glass shelf (12a) */}
          <section
            className="mt-8 bg-glass backdrop-blur-glass border border-glass-border rounded-glass px-5 py-4"
            aria-label="Feed"
          >
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                The feed · {builds?.length ?? 0}
              </span>
              <div className="flex-1" />
              <Link
                href="/discover"
                className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Discover builds ▸
              </Link>
            </div>
            <OnlineOnlyBanner surface="glass" className="mb-3" />

            {isLoading ? (
              <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
            ) : !userId ? (
              <EmptyState
                surface="glass"
                icon="group"
                message="Sign in to see builds from people you follow."
                action={
                  <Link
                    href="/auth/signin"
                    className="inline-flex min-h-[44px] items-center rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Sign in
                  </Link>
                }
              />
            ) : !builds || builds.length === 0 ? (
              <EmptyState
                surface="glass"
                icon="rss_feed"
                message="No builds yet from people you follow."
                secondary="Discover public builds and follow creators to fill your feed."
              />
            ) : (
              <ul className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1">
                {builds.map((b) => {
                  const owner = b.ownerUsername ? `@${b.ownerUsername}` : (b.ownerName ?? null);
                  const isFeatured = featured?._id === b._id;
                  return (
                    <li key={b._id} className="snap-start shrink-0 w-[170px]">
                      <Link
                        href={`/b/${b._id}`}
                        className={`relative block h-[170px] w-full overflow-hidden rounded-[10px] bg-glass-active transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                          isFeatured
                            ? "outline outline-[1.5px] -outline-offset-[1.5px] outline-glass-border-strong"
                            : ""
                        }`}
                        aria-label={`View ${b.name}`}
                      >
                        {b.imageStorageId || b.imageUrl ? (
                          <ResolvedImage
                            imageStorageId={b.imageStorageId}
                            imageUrl={b.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            aria-hidden
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-media-fg-45">
                            <span className="material-symbols-outlined text-4xl" aria-hidden>
                              palette
                            </span>
                          </span>
                        )}
                        <div className="absolute inset-0 bg-kyar-media-scrim" aria-hidden />
                        <div className="absolute left-0 right-0 bottom-0 p-2.5">
                          {owner && (
                            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] opacity-70 mb-0.5 truncate">
                              {owner}
                            </span>
                          )}
                          <span className="block font-serif italic text-[15px] leading-tight truncate">
                            {b.name}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </WebAppShell>
  );
}
