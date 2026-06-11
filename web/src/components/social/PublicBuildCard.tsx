"use client";

import Link from "next/link";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

export interface PublicBuildCardItem {
  _id: Id<"builds">;
  name: string;
  character?: string | null;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string | null;
  ownerUsername?: string | null;
  ownerName?: string | null;
  tasksTotal?: number;
  tasksChecked?: number;
}

interface PublicBuildCardProps {
  build: PublicBuildCardItem;
  /** Show owner attribution under the title (feed/discover). */
  showOwner?: boolean;
}

/**
 * Editorial public-build card: full-bleed image with scrim and serif title
 * overlay. Shared by Feed, Discover, and public profile grids; matches the
 * mobile PublicBuildCard treatment.
 */
export function PublicBuildCard({ build, showOwner = false }: PublicBuildCardProps) {
  const owner = build.ownerUsername ? `@${build.ownerUsername}` : (build.ownerName ?? null);

  return (
    <Link
      href={`/b/${build._id}`}
      className="group relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
    >
      {build.imageStorageId ? (
        <ResolvedImage
          imageStorageId={build.imageStorageId}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : build.imageUrl ? (
        <img
          src={build.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover:scale-105">
          <span className="material-symbols-outlined text-6xl" aria-hidden>
            palette
          </span>
        </div>
      )}
      <div
        className="absolute inset-0 bg-kyar-media-scrim transition-colors duration-300"
        aria-hidden
      />

      <div className="absolute inset-0 flex flex-col justify-end p-5 text-kyar-media-fg">
        {build.character && (
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">
            {build.character}
          </span>
        )}
        <h3 className="truncate font-serif text-2xl font-normal italic leading-none tracking-tight text-kyar-media-fg drop-shadow-md transition-opacity group-hover:opacity-90 lg:text-3xl">
          {build.name}
        </h3>
        <div className="flex items-center gap-3 pt-2">
          {showOwner && owner && (
            <span className="truncate text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm">
              {owner}
            </span>
          )}
          {typeof build.tasksTotal === "number" && build.tasksTotal > 0 && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm">
              {build.tasksChecked}/{build.tasksTotal} tasks
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
