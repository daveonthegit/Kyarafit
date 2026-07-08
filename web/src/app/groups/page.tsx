"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";

export default function GroupsPage() {
  const { userId, isLoading: authLoading } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const groupsQuery = useQuery(api.groups.listForUser, userId ? { userId } : "skip");
  const groups = groupsQuery ?? [];
  const isLoading = authLoading || (userId !== null && groupsQuery === undefined);

  // Featured = most recent from the same list that fills the shelf (12c).
  const featured: Doc<"groups"> | undefined = groups[0];

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop imageStorageId={featured?.imageStorageId} imageUrl={featured?.imageUrl} />

        <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-12 pb-6 min-h-0">
          {/* Featured group (12c) */}
          <section className="flex-1 min-w-0 max-w-[680px] lg:mt-4">
            {featured ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  Your groups · {featured.visibility}
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[80px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  {featured.name}
                </h1>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/g/${featured._id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Open group
                  </Link>
                </div>
              </>
            ) : !isLoading ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  Groups
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[64px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  Cosplay is better together.
                </h1>
              </>
            ) : null}
          </section>

          {/* Your groups — bottom glass shelf (12c) */}
          <section
            className="mt-8 bg-glass backdrop-blur-glass border border-glass-border rounded-glass px-5 py-4"
            aria-label="Your groups"
          >
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                Your groups · {groups.length}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => openCreationModal("newGroup")}
                className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Create group ▸
              </button>
            </div>
            <OnlineOnlyBanner surface="glass" className="mb-3" />

            {isLoading ? (
              <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
            ) : groups.length === 0 ? (
              <EmptyState
                surface="glass"
                icon="group"
                message="No groups yet."
                secondary="Create a group to coordinate cosplays with others and pick which convention days you’re wearing them."
              />
            ) : null}

            {!isLoading && (
              <ul className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1">
                {groups.map((group: Doc<"groups">) => {
                  const isFeatured = featured?._id === group._id;
                  return (
                    <li key={group._id} className="snap-start shrink-0 w-[200px]">
                      <Link
                        href={`/g/${group._id}`}
                        className={`relative block h-[150px] w-full overflow-hidden rounded-[10px] bg-glass-active transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                          isFeatured
                            ? "outline outline-[1.5px] -outline-offset-[1.5px] outline-glass-border-strong"
                            : ""
                        }`}
                        aria-label={`Open ${group.name}`}
                      >
                        {group.imageStorageId ? (
                          <ResolvedImage
                            imageStorageId={group.imageStorageId}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            aria-hidden
                          />
                        ) : group.imageUrl ? (
                          <img
                            src={group.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            aria-hidden
                          />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center bg-studio-wall text-media-fg-45">
                            <span className="material-symbols-outlined text-4xl" aria-hidden>
                              group
                            </span>
                          </span>
                        )}
                        <div className="absolute inset-0 bg-kyar-media-scrim" aria-hidden />
                        <div className="absolute left-0 right-0 bottom-0 p-2.5">
                          <span className="block text-[9px] font-bold uppercase tracking-[0.16em] opacity-70 mb-0.5">
                            {group.visibility}
                          </span>
                          <span className="block font-serif italic text-[16px] leading-tight truncate">
                            {group.name}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {userId && (
                  <li className="snap-start shrink-0 w-[200px]">
                    <button
                      type="button"
                      onClick={() => openCreationModal("newGroup")}
                      className="flex h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-kyar-media-ring text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      aria-label="Create group"
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden>
                        add
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
                        Create group
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </WebAppShell>
  );
}
