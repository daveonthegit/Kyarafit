"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";

export default function DiscoverPage() {
  const builds = useQuery(api.builds.listDiscover, { limit: 50 }) ?? [];

  return (
    <WebAppShell>
      <header className="pt-16 pb-6">
        <h1 className="font-serif text-4xl tracking-tight">Discover</h1>
        <p className="text-sm text-kyar-textSecondary mt-2">
          Public builds from the community.{" "}
          <Link href="/feed" className="text-kyar-accent hover:underline">
            From people you follow
          </Link>
        </p>
      </header>

      <main className="mt-6">
        {builds.length === 0 ? (
          <p className="text-sm text-kyar-textSecondary">No public builds yet.</p>
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
                    {b.character && (
                      <p className="text-xs text-kyar-textSecondary truncate">{b.character}</p>
                    )}
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
