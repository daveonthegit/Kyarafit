"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  EditorialProgressDonut,
  EditorialVerticalProgressRail,
} from "@/components/builds/EditorialBuildProgress";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

export type EditorialBackLink = { href: string; label: string };

export type EditorialComment = {
  _id: Id<"buildComments">;
  body: string;
  createdAt: number;
  authorName: string;
  authorUsername: string | null;
};

export type EditorialTaskRow = {
  _id: Id<"workflowItems">;
  label: string;
  checked: boolean;
  dueDate?: string;
  sortOrder: number;
};

export type EditorialPublicBuildDetailProps = {
  build: {
    _id: Id<"builds">;
    name: string;
    character?: string | null;
    status: string;
    notes?: string | null;
    imageStorageId?: Id<"_storage"> | null;
    imageUrl?: string | null;
    imageFocalX?: number | null;
    imageFocalY?: number | null;
  };
  backHeader: EditorialBackLink;
  backFooter: EditorialBackLink;
  brandHref?: string;
  tasks: EditorialTaskRow[];
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
  userId: string | null;
  likeCount: number | null | undefined;
  isLiked: boolean | undefined;
  onToggleLike: () => void;
  comments: EditorialComment[];
  commentBody: string;
  setCommentBody: (value: string) => void;
  onSubmitComment: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  commentPending: boolean;
};

function focalObjectPosition(fx?: number | null, fy?: number | null): string | undefined {
  if (fx == null || fy == null) return undefined;
  return `${fx * 100}% ${fy * 100}%`;
}

function formatTaskDue(dueDate?: string): string {
  if (!dueDate) return "—";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return dueDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EditorialPublicBuildDetail({
  build,
  backHeader,
  backFooter,
  brandHref = "/home",
  tasks,
  tasksTotal,
  tasksChecked,
  progress,
  userId,
  likeCount,
  isLiked,
  onToggleLike,
  comments,
  commentBody,
  setCommentBody,
  onSubmitComment,
  commentPending,
}: EditorialPublicBuildDetailProps) {
  const focalPos = focalObjectPosition(build.imageFocalX, build.imageFocalY);
  const focalStyle = focalPos ? ({ objectPosition: focalPos } as const) : undefined;
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <header className="pt-16 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-6xl mx-auto">
          <Link
            href={brandHref}
            className="font-serif text-lg sm:text-xl text-kyar-text tracking-tight hover:opacity-80 transition-opacity"
          >
            Kyarafit
          </Link>
          <Link
            href={backHeader.href}
            className="text-[11px] uppercase tracking-widest text-kyar-textSecondary hover:text-kyar-accent inline-flex items-center gap-1 sm:justify-end"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            {backHeader.label}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-2 pb-16">
        {/* Hero — title overlaid on image (editorial) */}
        <section className="relative rounded-md overflow-hidden border border-kyar-cardBorder bg-kyar-mutedWarm min-h-[min(52vw,380px)] sm:min-h-[400px] shadow-soft">
          <div className="absolute inset-0">
            {build.imageStorageId ? (
              <ResolvedImage
                imageStorageId={build.imageStorageId}
                alt={build.name}
                className="w-full h-full object-cover grayscale-[0.35] contrast-[1.02]"
                style={focalStyle}
              />
            ) : build.imageUrl ? (
              <img
                src={build.imageUrl}
                alt={build.name}
                className="w-full h-full object-cover grayscale-[0.35] contrast-[1.02]"
                style={focalStyle}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-kyar-muted to-kyar-mutedWarm" />
            )}
            <div className="absolute inset-0 bg-kyar-media-scrim-heavy" aria-hidden />
          </div>
          <div className="relative z-10 flex flex-col justify-end min-h-[min(52vw,380px)] sm:min-h-[400px] p-6 sm:p-10 lg:p-12">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-media-fg-muted sm:text-[11px]">
              <span className="capitalize">{build.status}</span>
              {tasksTotal > 0 && (
                <>
                  <span className="mx-2 opacity-60">·</span>
                  <span className="tabular-nums">
                    {tasksChecked}/{tasksTotal} tasks
                  </span>
                </>
              )}
            </p>
            <h1 className="max-w-[90%] font-serif text-4xl font-bold leading-[1.05] tracking-tight text-kyar-media-fg drop-shadow-md sm:text-5xl lg:text-6xl">
              {build.name}
            </h1>
            {build.character && (
              <p className="mt-3 max-w-xl text-base font-medium text-kyar-media-fg-muted sm:text-lg">
                {build.character}
              </p>
            )}
          </div>
        </section>

        {/* Body grid: left rail (progress) + main */}
        <div className="mt-10 lg:mt-12 flex flex-col lg:flex-row gap-10 lg:gap-14 lg:items-start">
          <aside className="flex flex-row lg:flex-col gap-8 lg:gap-10 lg:w-[200px] shrink-0 border-b border-kyar-borderSubtle lg:border-0 pb-8 lg:pb-0">
            <EditorialVerticalProgressRail progress={progress} />
            <div className="flex flex-col items-center gap-2">
              <EditorialProgressDonut progress={progress} />
              <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary text-center max-w-[9rem] leading-relaxed">
                Completion
              </p>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-10">
            {sortedTasks.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-kyar-text mb-6">Tasks &amp; Timeline</h2>
                <ul className="border-t border-kyar-borderSubtle">
                  {sortedTasks.map((t) => (
                    <li
                      key={t._id}
                      className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-6 py-4 border-b border-kyar-borderSubtle text-sm"
                    >
                      <span
                        className={`text-kyar-text leading-snug ${t.checked ? "line-through text-kyar-textTertiary" : ""}`}
                      >
                        {t.label}
                      </span>
                      <time className="text-kyar-textTertiary tabular-nums shrink-0 text-xs sm:text-sm tracking-wide">
                        {formatTaskDue(t.dueDate)}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-kyar-borderSubtle">
              {userId && (
                <button
                  type="button"
                  onClick={onToggleLike}
                  className="flex items-center gap-1 text-sm text-kyar-textTertiary hover:text-kyar-accent"
                  aria-label={isLiked ? "Unlike" : "Like"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {isLiked ? "favorite" : "favorite_border"}
                  </span>
                  {likeCount != null && likeCount > 0 && <span>{likeCount}</span>}
                </button>
              )}
              {!userId && likeCount != null && likeCount > 0 && (
                <span className="flex items-center gap-1 text-kyar-textTertiary">
                  <span className="material-symbols-outlined text-lg">favorite</span>
                  {likeCount}
                </span>
              )}
            </div>

            {build.notes && (
              <section className="pl-4 border-l-2 border-kyar-text/20">
                <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-2">
                  Notes
                </p>
                <p className="text-sm text-kyar-textSecondary whitespace-pre-wrap leading-relaxed">
                  {build.notes}
                </p>
              </section>
            )}
          </div>
        </div>

        <section className="mt-14 pt-12 border-t border-kyar-borderSubtle">
          <h2 className="font-serif text-2xl text-kyar-text mb-6">
            Comments
            <span className="text-kyar-textTertiary font-normal text-lg ml-2">
              ({comments.length})
            </span>
          </h2>
          {comments.length > 0 && (
            <ul className="space-y-6 mb-8">
              {comments.map((c) => (
                <li
                  key={c._id}
                  className="text-sm border-b border-kyar-borderSubtle pb-6 last:border-0 last:pb-0"
                >
                  <p className="font-medium text-kyar-textSecondary text-xs uppercase tracking-wider mb-1">
                    {c.authorUsername ? `@${c.authorUsername}` : c.authorName}
                  </p>
                  <p className="text-kyar-text whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  <p className="text-[11px] text-kyar-textTertiary mt-2">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {userId && (
            <form onSubmit={onSubmitComment} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                maxLength={10000}
                className="flex-1 border-0 border-b border-kyar-text/30 rounded-none px-0 py-3 text-sm bg-transparent focus:outline-none focus:border-kyar-text focus-visible:ring-0 placeholder:text-kyar-textTertiary"
                disabled={commentPending}
              />
              <button
                type="submit"
                disabled={commentPending || !commentBody.trim()}
                className="px-6 py-3 bg-kyar-text text-kyar-bg text-sm font-medium rounded-sm disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              >
                Post
              </button>
            </form>
          )}
        </section>

        <Link
          href={backFooter.href}
          className="mt-12 text-sm text-kyar-accent hover:underline inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {backFooter.label}
        </Link>
      </main>
    </>
  );
}
