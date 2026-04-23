"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ClosetCarouselCardContent } from "@/components/ui/closet-items-carousel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { WorkflowTree } from "@/components/builds/WorkflowTree";
import { BuildVisualBoard, type BuildVisualBoardNode } from "@/components/builds/BuildVisualBoard";
import { BuildSummarySection } from "@/components/builds/BuildSummarySection";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

type TabId = "explorer" | "tasks" | "board" | "summary";

export type PublicBuildDetailViewProps = {
  backHref: string;
  backLabel: string;
} & ({ mode: "public"; buildId: Id<"builds"> } | { mode: "share"; shareToken: string });

export function PublicBuildDetailView(props: PublicBuildDetailViewProps) {
  const { backHref, backLabel } = props;
  const bundleArgs =
    props.mode === "public" ? { buildId: props.buildId } : { shareToken: props.shareToken };
  const bundle = useQuery(api.builds.getPublicViewerBundle, bundleArgs);
  const { userId } = useCurrentUser();

  const buildId = bundle?.build._id;
  const shareTokenForQueries = props.mode === "share" ? props.shareToken : undefined;

  const likeCount = useQuery(
    api.buildLikes.countByBuild,
    buildId
      ? shareTokenForQueries
        ? { buildId, shareToken: shareTokenForQueries }
        : { buildId }
      : "skip"
  );
  const isLiked = useQuery(
    api.buildLikes.isLikedBy,
    buildId && userId ? { buildId, userId } : "skip"
  );
  const comments =
    useQuery(
      api.buildComments.listByBuild,
      buildId
        ? shareTokenForQueries
          ? { buildId, shareToken: shareTokenForQueries }
          : { buildId }
        : "skip"
    ) ?? [];

  const likeMut = useMutation(api.buildLikes.like);
  const unlikeMut = useMutation(api.buildLikes.unlike);
  const addCommentMut = useMutation(api.buildComments.add);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  const toggles = bundle?.togglesResolved;
  const visibleTabs = useMemo(() => {
    if (!toggles) return [] as TabId[];
    const tabs: TabId[] = [];
    if (toggles.showExplorer) tabs.push("explorer");
    if (toggles.showTasks) tabs.push("tasks");
    if (toggles.showVisualBoard) tabs.push("board");
    if (toggles.showSummary || toggles.showCollaborators) tabs.push("summary");
    return tabs;
  }, [toggles]);

  const [activeTab, setActiveTab] = useState<TabId>("explorer");
  const effectiveTab = useMemo(() => {
    if (visibleTabs.length === 0) return null;
    return visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0];
  }, [visibleTabs, activeTab]);

  if (bundle === undefined) {
    return (
      <WebAppShell>
        <div className="flex min-h-[50vh] items-center justify-center pt-16">
          <p className="text-kyar-textSecondary">Loading…</p>
        </div>
      </WebAppShell>
    );
  }

  if (bundle === null) {
    return (
      <WebAppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 pt-16">
          <p className="text-kyar-textSecondary">
            {props.mode === "share"
              ? "Link invalid or build not found."
              : "Build not found or not public."}
          </p>
          <Link href="/home" className="mt-4 text-sm text-kyar-accent hover:underline">
            Go home
          </Link>
        </div>
      </WebAppShell>
    );
  }

  const build = bundle.build;
  const tasksTotal = build.tasksTotal ?? 0;
  const tasksChecked = build.tasksChecked ?? 0;
  const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  const visualBoardNodes: BuildVisualBoardNode[] = bundle.visualNodes.map((n) => ({
    _id: n._id,
    name: n.name,
    imageUrl: n.imageUrl,
    imageStorageId: n.imageStorageId,
    nodeType: n.nodeType,
    progressPercent: n.progressPercent,
    childCount: n.childCount,
    hasIncompleteDescendants: n.hasIncompleteDescendants,
    isRoot: n.isRoot,
    depth: n.depth,
  }));

  const outlineNodes = [...bundle.visualNodes].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });

  return (
    <WebAppShell>
      <header className="pb-4 pt-16">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-kyar-textSecondary hover:text-kyar-accent"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          {backLabel}
        </Link>
      </header>

      <main className="mx-auto mt-6 max-w-4xl space-y-8 pb-16">
        <div className="overflow-hidden rounded-lg border border-kyar-cardBorder bg-kyar-card">
          <div className="relative aspect-[21/9] bg-kyar-mutedWarm sm:aspect-[3/1]">
            {build.imageStorageId ? (
              <ResolvedImage
                imageStorageId={build.imageStorageId}
                alt={build.name}
                className="h-full w-full object-cover"
                style={{
                  objectPosition:
                    build.imageFocalX != null && build.imageFocalY != null
                      ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
                      : "center",
                }}
              />
            ) : build.imageUrl ? (
              <img
                src={build.imageUrl}
                alt={build.name}
                className="h-full w-full object-cover"
                style={{
                  objectPosition:
                    build.imageFocalX != null && build.imageFocalY != null
                      ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
                      : "center",
                }}
              />
            ) : (
              <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-5xl text-kyar-textTertiary">
                palette
              </span>
            )}
          </div>
          <div className="p-5 sm:p-8">
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">{build.name}</h1>
            {build.character && <p className="mt-1 text-kyar-textSecondary">{build.character}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-kyar-textTertiary">
              <span className="capitalize">{build.status}</span>
              {tasksTotal > 0 && (
                <span>
                  {tasksChecked}/{tasksTotal} tasks ({progress}%)
                </span>
              )}
              {userId && (
                <button
                  type="button"
                  onClick={() =>
                    isLiked
                      ? unlikeMut({ userId, buildId: build._id })
                      : likeMut({ userId, buildId: build._id })
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
                <span className="flex items-center gap-1 text-kyar-textTertiary">
                  <span className="material-symbols-outlined text-lg">favorite</span>
                  {likeCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {visibleTabs.length > 0 && (
          <nav className="flex flex-wrap gap-2 border-t border-kyar-borderSubtle pt-4">
            {visibleTabs.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`rounded-full border px-4 py-2 text-[10px] uppercase tracking-widest transition-colors ${
                  effectiveTab === value
                    ? "border-kyar-text bg-kyar-text text-kyar-bg"
                    : "border-kyar-borderSubtle text-kyar-textTertiary hover:border-kyar-text hover:text-kyar-text"
                }`}
              >
                {value === "explorer"
                  ? "Explorer"
                  : value === "tasks"
                    ? "Tasks"
                    : value === "board"
                      ? "Visual board"
                      : "Summary"}
              </button>
            ))}
          </nav>
        )}

        {toggles?.showExplorer && effectiveTab === "explorer" && (
          <section className="space-y-8 border-t border-kyar-borderSubtle pt-6">
            {toggles.showNotes && build.notes && (
              <section className="border-l-2 border-kyar-text/20 pl-5">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-kyar-textSecondary">
                  {build.notes}
                </p>
              </section>
            )}
            {outlineNodes.length > 0 && (
              <section>
                <h2 className="mb-4 font-serif text-xl text-kyar-text">Outline</h2>
                <ul className="space-y-2 rounded-xl border border-kyar-borderSubtle bg-kyar-surface p-4">
                  {outlineNodes.map((n) => (
                    <li
                      key={n._id}
                      className="flex items-center gap-2 text-sm text-kyar-text"
                      style={{ paddingLeft: Math.min(n.depth, 8) * 12 }}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-kyar-textTertiary">
                        {n.nodeType === "material" ? "Material" : "Element"}
                      </span>
                      <Link
                        href={`/elements/${n._id}`}
                        className="font-medium hover:text-kyar-accent hover:underline"
                      >
                        {n.name}
                      </Link>
                      <span className="text-kyar-textTertiary">{n.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>
        )}

        {toggles?.showTasks && effectiveTab === "tasks" && (
          <section className="border-t border-kyar-borderSubtle pt-6">
            <h2 className="mb-6 font-serif text-2xl text-kyar-text">Tasks &amp; timeline</h2>
            <WorkflowTree
              buildId={build._id}
              userId={null}
              shareToken={shareTokenForQueries}
              hideComposer
            />
          </section>
        )}

        {toggles?.showVisualBoard && effectiveTab === "board" && (
          <section className="border-t border-kyar-borderSubtle pt-6">
            <BuildVisualBoard
              buildId={build._id}
              userId={null}
              linkedNodes={visualBoardNodes}
              onOpenLinkNodes={() => {}}
              shareToken={shareTokenForQueries}
              prefetchedReferenceImages={bundle.referenceImages}
              prefetchedProcessPictures={bundle.processPictures}
              readOnly
              renderNodeCard={(item) => (
                <Link
                  href={`/elements/${item._id}`}
                  className="block cursor-pointer rounded-sm transition-opacity hover:opacity-95"
                >
                  <ClosetCarouselCardContent
                    item={{
                      ...item,
                      costCents: null,
                    }}
                    formatCents={formatCents}
                  />
                </Link>
              )}
            />
          </section>
        )}

        {(toggles?.showSummary || toggles?.showCollaborators) && effectiveTab === "summary" && (
          <section className="border-t border-kyar-borderSubtle pt-6">
            <div
              className={`grid gap-6 ${toggles.showSummary && toggles.showCollaborators ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}
            >
              {toggles.showSummary && (
                <div>
                  <BuildSummarySection summary={bundle.summary} formatCents={formatCents} />
                </div>
              )}
              {toggles.showCollaborators && (
                <div className="rounded-[24px] border border-kyar-borderSubtle bg-kyar-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        Collaborators
                      </p>
                      <h2 className="mt-2 font-serif text-2xl text-kyar-text">Team</h2>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {bundle.collaborators.length > 0 ? (
                      bundle.collaborators.map((c) => (
                        <div
                          key={c.collaboratorId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-kyar-borderSubtle px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-muted text-xs font-serif text-kyar-text">
                              {c.displayLabel.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-kyar-text">{c.displayLabel}</p>
                              <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                                {c.role}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-kyar-textTertiary">No collaborators.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-8 border-t border-kyar-borderSubtle pt-6">
          <h2 className="mb-3 text-[11px] uppercase tracking-widest text-kyar-textSecondary">
            Comments ({comments.length})
          </h2>
          {comments.length > 0 && (
            <ul className="mb-4 space-y-3">
              {comments.map((c) => (
                <li key={c._id} className="text-sm">
                  <p className="font-medium text-kyar-textSecondary">
                    {c.authorUsername ? `@${c.authorUsername}` : c.authorName}
                  </p>
                  <p className="whitespace-pre-wrap text-kyar-text">{c.body}</p>
                  <p className="mt-0.5 text-[11px] text-kyar-textTertiary">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {userId && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!commentBody.trim() || commentPending) return;
                setCommentPending(true);
                try {
                  await addCommentMut({ userId, buildId: build._id, body: commentBody.trim() });
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
                className="flex-1 rounded-md border border-kyar-cardBorder px-3 py-2 text-sm"
                disabled={commentPending}
              />
              <button
                type="submit"
                disabled={commentPending || !commentBody.trim()}
                className="rounded-md bg-kyar-text px-4 py-2 text-sm font-medium text-kyar-bg disabled:opacity-50"
              >
                Post
              </button>
            </form>
          )}
        </section>

        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-1 text-sm text-kyar-accent hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {backLabel}
        </Link>
      </main>
    </WebAppShell>
  );
}
