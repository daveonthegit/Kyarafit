"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function UnlistedBuildPage() {
  const params = useParams();
  const shareToken = typeof params.shareToken === "string" ? params.shareToken : "";
  const { userId } = useCurrentUser();
  const build = useQuery(api.builds.getByShareToken, shareToken ? { shareToken } : "skip");
  const buildId = build?._id;
  const likeCount = useQuery(api.buildLikes.countByBuild, buildId ? { buildId } : "skip");
  const isLiked = useQuery(
    api.buildLikes.isLikedBy,
    buildId && userId ? { buildId, userId } : "skip"
  );
  const comments = useQuery(api.buildComments.listByBuild, buildId ? { buildId } : "skip") ?? [];
  const likeMut = useMutation(api.buildLikes.like);
  const unlikeMut = useMutation(api.buildLikes.unlike);
  const addCommentMut = useMutation(api.buildComments.add);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  if (shareToken && build === null) {
    return (
      <WebAppShell>
        <div className="pt-16 flex flex-col items-center justify-center px-6 min-h-[50vh]">
          <p className="text-kyar-textSecondary">Link invalid or build not found.</p>
          <Link href="/home" className="mt-4 text-sm text-kyar-accent hover:underline">
            Go home
          </Link>
        </div>
      </WebAppShell>
    );
  }

  if (build === undefined) {
    return (
      <WebAppShell>
        <div className="pt-16 flex items-center justify-center min-h-[50vh]">
          <p className="text-kyar-textSecondary">Loading…</p>
        </div>
      </WebAppShell>
    );
  }

  if (!build) {
    return null;
  }

  const tasksTotal = build.tasksTotal ?? 0;
  const tasksChecked = build.tasksChecked ?? 0;
  const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  return (
    <WebAppShell>
      <header className="pt-16 pb-4">
        <Link
          href="/home"
          className="text-[11px] uppercase tracking-widest text-kyar-textSecondary hover:text-kyar-accent inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Home
        </Link>
      </header>

      <main className="max-w-2xl mx-auto mt-6">
        <div className="rounded-lg overflow-hidden border border-kyar-cardBorder bg-kyar-card mb-6">
          <div className="aspect-[4/3] bg-kyar-mutedWarm relative">
            {build.imageStorageId ? (
              <ResolvedImage
                imageStorageId={build.imageStorageId}
                alt={build.name}
                className="w-full h-full object-cover"
                style={{
                  objectPosition:
                    build.imageFocalX != null && build.imageFocalY != null
                      ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
                      : undefined,
                }}
              />
            ) : build.imageUrl ? (
              <img
                src={build.imageUrl}
                alt={build.name}
                className="w-full h-full object-cover"
                style={{
                  objectPosition:
                    build.imageFocalX != null && build.imageFocalY != null
                      ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
                      : undefined,
                }}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary material-symbols-outlined text-5xl">
                palette
              </span>
            )}
          </div>
          <div className="p-5">
            <h1 className="font-serif text-2xl font-semibold">{build.name}</h1>
            {build.character && <p className="text-kyar-textSecondary mt-1">{build.character}</p>}
            <div className="flex items-center gap-3 mt-3 text-sm text-kyar-textTertiary">
              <span className="capitalize">{build.status}</span>
              {tasksTotal > 0 && (
                <span>
                  {tasksChecked}/{tasksTotal} tasks ({progress}%)
                </span>
              )}
              {userId && buildId && (
                <button
                  type="button"
                  onClick={() =>
                    isLiked ? unlikeMut({ userId, buildId }) : likeMut({ userId, buildId })
                  }
                  className="flex items-center gap-1 text-kyar-textTertiary hover:text-kyar-accent"
                  aria-label={isLiked ? "Unlike" : "Like"}
                >
                  <span className="material-symbols-outlined text-lg">
                    {isLiked ? "favorite" : "favorite_border"}
                  </span>
                  {likeCount != null && likeCount > 0 && <span>{likeCount}</span>}
                </button>
              )}
              {!userId && likeCount != null && likeCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-lg">favorite</span>
                  {likeCount}
                </span>
              )}
            </div>
            {build.notes && (
              <div className="mt-4 pt-4 border-t border-kyar-borderSubtle">
                <p className="text-sm text-kyar-textSecondary whitespace-pre-wrap">{build.notes}</p>
              </div>
            )}
          </div>
        </div>

        <section className="mt-8 pt-6 border-t border-kyar-borderSubtle">
          <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">
            Comments ({comments.length})
          </h2>
          {comments.length > 0 && (
            <ul className="space-y-3 mb-4">
              {comments.map((c) => (
                <li key={c._id} className="text-sm">
                  <p className="font-medium text-kyar-textSecondary">
                    {c.authorUsername ? `@${c.authorUsername}` : c.authorName}
                  </p>
                  <p className="text-kyar-text whitespace-pre-wrap">{c.body}</p>
                  <p className="text-[11px] text-kyar-textTertiary mt-0.5">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {userId && buildId && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!buildId || !commentBody.trim() || commentPending) return;
                setCommentPending(true);
                try {
                  await addCommentMut({ userId, buildId, body: commentBody.trim() });
                  setCommentBody("");
                } finally {
                  setCommentPending(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                maxLength={10000}
                className="flex-1 border border-kyar-cardBorder rounded-md px-3 py-2 text-sm"
                disabled={commentPending}
              />
              <button
                type="submit"
                disabled={commentPending || !commentBody.trim()}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                Post
              </button>
            </form>
          )}
        </section>

        <Link
          href="/home"
          className="mt-6 text-sm text-kyar-accent hover:underline inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Home
        </Link>
      </main>
    </WebAppShell>
  );
}
