"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";

export default function GroupsPage() {
  const { userId } = useCurrentUser();
  const groups = useQuery(api.groups.listForUser, userId ? { userId } : "skip") ?? [];

  return (
    <WebAppShell>
      <PageHeader
        title="Groups"
        primaryAction={{ label: "New group", href: "/groups/new" }}
      />
      <main className="mt-6">
        {groups.length === 0 ? (
          <div className="py-12 text-center text-kyar-textSecondary">
            <p className="mb-2">No groups yet.</p>
            <p className="text-sm mb-4">
              Create a group to coordinate cosplays with others and pick which convention days you’re wearing them.
            </p>
            <Link
              href="/groups/new"
              className="inline-block px-4 py-2 bg-black text-white text-sm font-medium uppercase tracking-wider rounded-sm hover:opacity-90"
            >
              Create group
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group: Doc<"groups">) => (
              <li key={group._id}>
                <Link
                  href={`/g/${group._id}`}
                  className="block border border-kyar-cardBorder rounded-lg overflow-hidden bg-kyar-card hover:border-kyar-accent/50 transition-colors"
                >
                  <div className="aspect-[16/10] bg-kyar-mutedWarm relative">
                    {group.imageStorageId ? (
                      <ResolvedImage
                        imageStorageId={group.imageStorageId}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : group.imageUrl ? (
                      <img
                        src={group.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary material-symbols-outlined text-4xl">
                        group
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium truncate">{group.name}</p>
                    {group.description && (
                      <p className="text-xs text-kyar-textSecondary line-clamp-2 mt-0.5">
                        {group.description}
                      </p>
                    )}
                    <p className="text-[11px] text-kyar-textTertiary mt-1 capitalize">
                      {group.visibility}
                    </p>
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
