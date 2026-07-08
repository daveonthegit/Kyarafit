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
      className="group relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-glass border border-glass-border bg-glass-active transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
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
        <div className="absolute inset-0 flex items-center justify-center bg-studio-wall text-media-fg-45 transition-transform duration-700 group-hover:scale-105">
          <span className="material-symbols-outlined text-6xl" aria-hidden>
            palette
          </span>
        </div>
      )}
      <div
        className="absolute inset-0 bg-kyar-media-scrim transition-colors duration-300"
        aria-hidden
      />

      {showOwner && owner && (
        <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-on-glass-chip-neutral-bg px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-neutral-fg backdrop-blur-glass-chip">
          {owner}
        </span>
      )}

      <div className="absolute inset-0 flex flex-col justify-end p-5 text-kyar-media-fg">
        {build.character && (
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">
            {build.character}
          </span>
        )}
        <h3 className="truncate font-serif text-2xl font-normal italic leading-none tracking-tight text-kyar-media-fg drop-shadow-md transition-opacity group-hover:opacity-90 lg:text-3xl">
          {build.name}
        </h3>
        {typeof build.tasksTotal === "number" && build.tasksTotal > 0 && (
          <span className="pt-2 text-[10px] font-bold uppercase tracking-[0.16em] opacity-90 drop-shadow-sm">
            {build.tasksChecked}/{build.tasksTotal} tasks
          </span>
        )}
      </div>
    </Link>
  );
}
