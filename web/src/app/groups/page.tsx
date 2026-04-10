"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";

export default function GroupsPage() {
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const groups = useQuery(api.groups.listForUser, userId ? { userId } : "skip") ?? [];

  return (
    <WebAppShell>
      <PageHeader title="Groups" subtitle="Coordinate with others" />
      <main className="flex-1 py-6">
        {groups.length === 0 ? (
          <EmptyState
            icon="group"
            message="No groups yet."
            secondary="Create a group to coordinate cosplays with others and pick which convention days you’re wearing them."
            action={
              <button
                type="button"
                onClick={() => openCreationModal("newGroup")}
                className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-kyar-text px-6 py-2.5 rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                Create group
              </button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: Doc<"groups">) => (
              <li key={group._id}>
                <Link
                  href={`/g/${group._id}`}
                  className="block relative aspect-video w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group/card"
                >
                  {group.imageStorageId ? (
                    <ResolvedImage
                      imageStorageId={group.imageStorageId}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                    />
                  ) : group.imageUrl ? (
                    <img
                      src={group.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover/card:scale-105">
                      <span className="material-symbols-outlined text-6xl">group</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-kyar-text/80 via-kyar-text/20 to-transparent transition-colors duration-300" />

                  <div className="absolute inset-0 p-5 flex flex-col justify-end text-kyar-bg">
                    <div className="flex justify-between items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase block mb-1">
                          {group.visibility}
                        </span>
                        <h3 className="font-serif text-2xl lg:text-3xl font-normal italic tracking-tight leading-none truncate drop-shadow-sm transition-opacity group-hover/card:opacity-90">
                          {group.name}
                        </h3>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </WebAppShell>
  );
}
