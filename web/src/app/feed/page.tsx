"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";

export default function FeedPage() {
  const { userId } = useCurrentUser();
  const builds =
    useQuery(api.builds.listFeedFromFollowing, userId ? { userId, limit: 50 } : "skip") ?? [];

  return (
    <WebAppShell>
      <header className="pt-16 pb-6">
        <h1 className="font-serif text-4xl tracking-tight">Feed</h1>
        <p className="text-sm text-kyar-textSecondary mt-2">
          Public builds from people you follow.{" "}
          <Link href="/discover" className="text-kyar-accent hover:underline">
            Discover all
          </Link>
        </p>
      </header>

      <main className="mt-6">
        {!userId ? (
          <p className="text-sm text-kyar-textSecondary">
            <Link href="/auth/signin" className="text-kyar-accent hover:underline">
              Sign in
            </Link>{" "}
            to see builds from people you follow.
          </p>
        ) : builds.length === 0 ? (
          <p className="text-sm text-kyar-textSecondary">
            No builds yet from people you follow.{" "}
            <Link href="/discover" className="text-kyar-accent hover:underline">
              Discover
            </Link>{" "}
            public builds and follow creators.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builds.map((b) => (
              <li key={b._id}>
                <Link
                  href={`/b/${b._id}`}
                  className="block border border-kyar-cardBorder rounded-lg overflow-hidden bg-kyar-card hover:border-kyar-accent/50 transition-colors"
                >
                  <div className="aspect-[4/3] bg-kyar-mutedWarm relative">
                    {b.imageStorageId ? (
                      <ResolvedImage
                        imageStorageId={b.imageStorageId}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : b.imageUrl ? (
                      <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary material-symbols-outlined text-4xl">
                        palette
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium truncate">{b.name}</p>
                    {(b.ownerUsername || b.ownerName) && (
                      <p className="text-xs text-kyar-textTertiary mt-1">
                        {b.ownerUsername ? `@${b.ownerUsername}` : b.ownerName}
                      </p>
                    )}
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
