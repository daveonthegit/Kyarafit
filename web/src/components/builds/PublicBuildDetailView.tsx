"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
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
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg">
          <div className="flex min-h-[50vh] items-center justify-center pt-16">
            <p className="text-media-fg-70">Loading…</p>
          </div>
        </div>
      </WebAppShell>
    );
  }

  if (bundle === null) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg">
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 pt-16">
            <p className="text-media-fg-70">
              {props.mode === "share"
                ? "Link invalid or build not found."
                : "Build not found or not public."}
            </p>
            <Link
              href="/home"
              className="mt-4 text-sm text-kyar-media-fg border-b border-glass-border-strong pb-0.5 hover:opacity-80"
            >
              Go home
            </Link>
          </div>
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
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={build.imageStorageId}
          imageUrl={build.imageUrl}
          objectPosition={
            build.imageFocalX != null && build.imageFocalY != null
              ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
              : undefined
          }
        />

        {/* Viewer bar (8c): no edit chrome */}
        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            Public build ▸ {build.name}
          </span>
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 flex-1 space-y-6">
          {/* Identity block (8c) */}
          <div className="max-w-[720px]">
            <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
              {build.character ? `${build.character} · ` : ""}
              {build.status}
            </span>
            <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] sm:text-[56px] lg:text-[72px]">
              {build.name}
            </h1>
            {tasksTotal > 0 && (
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="h-[2px] w-[180px] sm:w-[260px] bg-glass-border rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={tasksChecked}
                  aria-valuemin={0}
                  aria-valuemax={tasksTotal}
                >
                  <div
                    className="h-full bg-kyar-media-fg rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 tabular-nums">
                  {tasksChecked} / {tasksTotal} tasks · {progress}%
                </span>
              </div>
            )}
            {/* Social actions as glass outline pills (8c) */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {userId ? (
                <button
                  type="button"
                  onClick={() =>
                    isLiked
                      ? unlikeMut({ userId, buildId: build._id })
                      : likeMut({ userId, buildId: build._id })
                  }
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  aria-label={isLiked ? "Unlike" : "Like"}
                  aria-pressed={Boolean(isLiked)}
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden>
                    {isLiked ? "favorite" : "favorite_border"}
                  </span>
                  {likeCount != null && likeCount > 0 ? likeCount : "Like"}
                </button>
              ) : (
                likeCount != null &&
                likeCount > 0 && (
                  <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em]">
                    <span className="material-symbols-outlined text-[15px]" aria-hidden>
                      favorite
                    </span>
                    {likeCount}
                  </span>
                )
              )}
              <a
                href="#public-build-comments"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                <span className="material-symbols-outlined text-[15px]" aria-hidden>
                  chat_bubble
                </span>
                {comments.length}
              </a>
            </div>
          </div>

          {/* Work panel: owner-enabled tabs + comments (8c) */}
          <section className="bg-glass backdrop-blur-glass border border-glass-border rounded-glass">
            <div className="px-5 py-4 border-b border-glass-divider-strong space-y-3">
              <OnlineOnlyBanner surface="glass" />
              {visibleTabs.length > 0 && (
                <nav className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  {visibleTabs.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActiveTab(value)}
                      aria-pressed={effectiveTab === value}
                      className={`text-[10px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        effectiveTab === value
                          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                      }`}
                    >
                      {value === "explorer"
                        ? "Elements"
                        : value === "tasks"
                          ? "Tasks"
                          : value === "board"
                            ? "Board"
                            : "Summary"}
                    </button>
                  ))}
                </nav>
              )}
            </div>

            <div className="p-4 sm:p-5 space-y-8">
              {toggles?.showExplorer && effectiveTab === "explorer" && (
                <section className="space-y-8">
                  {toggles.showNotes && build.notes && (
                    <section className="border-l-2 border-glass-border-strong pl-5">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                        Notes
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-media-fg-70">
                        {build.notes}
                      </p>
                    </section>
                  )}
                  {outlineNodes.length > 0 && (
                    <section>
                      <h2 className="mb-4 font-serif italic text-xl">Outline</h2>
                      <ul className="space-y-2 rounded-[10px] border border-glass-border p-4">
                        {outlineNodes.map((n) => (
                          <li
                            key={n._id}
                            className="flex items-center gap-2 text-sm"
                            style={{ paddingLeft: Math.min(n.depth, 8) * 12 }}
                          >
                            <span className="text-[10px] uppercase tracking-[0.14em] text-media-fg-55">
                              {n.nodeType === "material" ? "Material" : "Element"}
                            </span>
                            <Link
                              href={`/elements/${n._id}`}
                              className="font-medium hover:underline"
                            >
                              {n.name}
                            </Link>
                            <span className="text-media-fg-55">{n.progressPercent}%</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </section>
              )}

              {toggles?.showTasks && effectiveTab === "tasks" && (
                <section>
                  <h2 className="mb-6 font-serif italic text-2xl">Tasks &amp; timeline</h2>
                  <WorkflowTree
                    buildId={build._id}
                    userId={null}
                    shareToken={shareTokenForQueries}
                    hideComposer
                  />
                </section>
              )}

              {toggles?.showVisualBoard && effectiveTab === "board" && (
                <section>
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

              {(toggles?.showSummary || toggles?.showCollaborators) &&
                effectiveTab === "summary" && (
                  <section>
                    <div
                      className={`grid gap-6 ${toggles.showSummary && toggles.showCollaborators ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}
                    >
                      {toggles.showSummary && (
                        <div>
                          <BuildSummarySection summary={bundle.summary} formatCents={formatCents} />
                        </div>
                      )}
                      {toggles.showCollaborators && (
                        <div className="rounded-glass border border-glass-border bg-glass-active p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                                Collaborators
                              </p>
                              <h2 className="mt-2 font-serif italic text-2xl">Team</h2>
                            </div>
                          </div>
                          <div className="mt-5 space-y-3">
                            {bundle.collaborators.length > 0 ? (
                              bundle.collaborators.map((c) => (
                                <div
                                  key={c.collaboratorId}
                                  className="flex items-center justify-between gap-3 rounded-[10px] border border-glass-border px-4 py-3"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass text-xs font-serif">
                                      {c.displayLabel.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">{c.displayLabel}</p>
                                      <p className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                                        {c.role}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-media-fg-55">No collaborators.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
            </div>

            {/* Comments (8c) */}
            <section
              id="public-build-comments"
              className="border-t border-glass-divider-strong px-5 py-4 scroll-mt-24"
            >
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                Comments · {comments.length}
              </h2>
              {comments.length > 0 && (
                <ul className="mb-4 space-y-3">
                  {comments.map((c) => (
                    <li key={c._id} className="text-sm border-b border-glass-divider pb-3">
                      <p className="font-medium text-media-fg-70">
                        {c.authorUsername ? `@${c.authorUsername}` : c.authorName}
                      </p>
                      <p className="whitespace-pre-wrap text-[13px]">{c.body}</p>
                      <p className="mt-0.5 text-[11px] text-media-fg-55">
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
                    className="flex-1 min-w-0 bg-transparent border-b border-glass-border py-2 text-[13px] focus:outline-none focus:border-kyar-media-fg placeholder:text-media-fg-55 transition-colors"
                    disabled={commentPending}
                  />
                  <button
                    type="submit"
                    disabled={commentPending || !commentBody.trim()}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Post
                  </button>
                </form>
              )}
            </section>
          </section>
        </main>
      </div>
    </WebAppShell>
  );
}
