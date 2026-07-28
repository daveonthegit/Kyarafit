"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { WorkflowTree } from "@/components/builds/WorkflowTree";
import { BuildNotesModal } from "@/components/builds/BuildNotesModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { BuildVisualBoard, type BuildVisualBoardNode } from "@/components/builds/BuildVisualBoard";
import type { BuildDetailFabModal } from "@/components/builds/BuildDetailFab";
import { BuildPhotoBatchModal } from "@/components/builds/BuildPhotoBatchModal";
import { BuildLinkClosetModal } from "@/components/builds/BuildLinkClosetModal";
import { BuildAddTaskModal } from "@/components/builds/BuildAddTaskModal";
import { BuildInviteCollaboratorModal } from "@/components/builds/BuildInviteCollaboratorModal";
import { BuildNodeManagerSection } from "@/components/builds/BuildNodeManagerSection";
import { BuildSummarySection } from "@/components/builds/BuildSummarySection";
import { BuildProgressTimeline } from "@/components/builds/BuildProgressTimeline";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useFeatureAccess } from "@/lib/api/useTier";
import { can } from "@kyarafit/design-system/domain/entitlements";

const STATUSES: BuildStatus[] = ["idea", "wip", "ready", "archived"];
type CosplayNodeId = Id<"cosplayNodes">;

type LinkedNode = Omit<BuildVisualBoardNode, "_id" | "nodeType"> & {
  _id: CosplayNodeId;
  nodeType: "element" | "material";
  category?: string;
  tags?: string[];
  totalCostCents?: number | null;
  directCostCents?: number | null;
  overallBucket?: "incomplete" | "in_progress" | "complete";
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  _creationTime?: number;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export default function BuildDetailPage() {
  const params = useParams();
  const rawId = params.id;
  const id =
    typeof rawId === "string"
      ? (rawId as Id<"builds">)
      : Array.isArray(rawId)
        ? (rawId[0] as Id<"builds">)
        : null;
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const { tier } = useFeatureAccess();
  // REQ-017: publishing a build (unlisted/public + share token) is a paid action.
  const canPublish = can(tier, "public_share");

  // Local-first reads (builds/buildTasks/cosplayNodes are sync-backed per DATA_AND_SYNC): they go
  // through the offline bridge so the screen paints from cache + works offline.
  const build = useOfflineQuery(api.builds.get, id ? { id } : "skip");
  const summary = useOfflineQuery(
    api.builds.getSummary,
    id && userId ? { buildId: id, userId } : "skip"
  );
  const linkedNodeIds = (useOfflineQuery(api.builds.getNodes, id ? { buildId: id } : "skip") ??
    []) as CosplayNodeId[];
  const nodeCatalog = (useOfflineQuery(
    api.cosplayNodes.list,
    userId && id ? { userId, buildId: id, sortBy: "name" } : "skip"
  ) ?? []) as LinkedNode[];
  const visualBoardNodes = (useOfflineQuery(
    api.cosplayNodes.listBuildVisualNodes,
    id ? { buildId: id } : "skip"
  ) ?? []) as BuildVisualBoardNode[];
  const tasks = useOfflineQuery(api.buildTasks.listByBuild, id ? { buildId: id } : "skip") ?? [];
  const boardReferenceImages =
    useOfflineQuery(api.buildReferenceImages.listByBuild, id ? { buildId: id } : "skip") ?? [];
  const boardProcessPictures =
    useOfflineQuery(api.buildProcessPictures.listByBuild, id ? { buildId: id } : "skip") ?? [];

  // Linked node objects for this build, resolved from the catalog by their linked ids (hierarchy +
  // drag/drop linking live in BuildNodeManagerSection).
  const linkedNodes = useMemo(() => {
    const byId = new Map(nodeCatalog.map((node) => [node._id, node]));
    return linkedNodeIds
      .map((nodeId) => byId.get(nodeId))
      .filter((node): node is LinkedNode => Boolean(node));
  }, [linkedNodeIds, nodeCatalog]);

  // Local-first writes go through the offline bridge (queued + optimistic when offline).
  const updateTask = useOfflineMutation(api.buildTasks.update);
  const updateBuild = useOfflineMutation(api.builds.update);
  const addReferenceImage = useOfflineMutation(api.buildReferenceImages.add);
  const addProgressPhoto = useOfflineMutation(api.buildProcessPictures.add);
  // Node hierarchy/link writes stay local-first (cosplayNodes/builds carry sync metadata).
  const linkNodes = useOfflineMutation(api.builds.linkNodes);
  const addChildLink = useOfflineMutation(api.cosplayNodes.addChildLink);

  // Collaborators are an online-only feature (no sync metadata) — keep on convex/react.
  const collaborators =
    useQuery(api.buildCollaborators.listByBuild, id && userId ? { buildId: id, userId } : "skip") ??
    [];
  const removeCollaborator = useMutation(api.buildCollaborators.remove);
  const justDroppedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCharacter, setEditCharacter] = useState("");
  const [editStatus, setEditStatus] = useState<BuildStatus>("wip");
  const [editBudgetCents, setEditBudgetCents] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageStorageId, setEditImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [notesSavePending, setNotesSavePending] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [editVisibility, setEditVisibility] = useState<"private" | "unlisted" | "public">(
    "private"
  );
  type PublicViewerToggleKey =
    | "showExplorer"
    | "showTasks"
    | "showVisualBoard"
    | "showSummary"
    | "showNotes"
    | "showCollaborators";
  type PublicViewerToggleState = Record<PublicViewerToggleKey, boolean>;
  const defaultPublicViewer: PublicViewerToggleState = {
    showExplorer: true,
    showTasks: true,
    showVisualBoard: true,
    showSummary: true,
    showNotes: true,
    showCollaborators: true,
  };
  const [publicViewerToggles, setPublicViewerToggles] =
    useState<PublicViewerToggleState>(defaultPublicViewer);
  const [fabModal, setFabModal] = useState<BuildDetailFabModal | null>(null);
  const [activeTab, setActiveTab] = useState<"explorer" | "tasks" | "progress" | "summary">(
    "explorer"
  );
  const [boardOpen, setBoardOpen] = useState(false);

  useEffect(() => {
    if (!boardOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoardOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [boardOpen]);

  useEffect(() => {
    if (build && isEditing) {
      setEditName(build.name);
      setEditCharacter(build.character ?? "");
      setEditStatus((build.status as BuildStatus) ?? "wip");
      setEditBudgetCents(build.budgetCents != null ? (build.budgetCents / 100).toFixed(2) : "");
      setEditTargetDate(build.targetDate ?? "");
      setEditImageUrl(build.imageUrl ?? "");
      setEditImageStorageId(build.imageStorageId ?? null);
      setEditVisibility((build.visibility as "private" | "unlisted" | "public") ?? "private");
      const p = build.publicViewerSettings ?? {};
      setPublicViewerToggles({
        showExplorer: p.showExplorer !== false,
        showTasks: p.showTasks !== false,
        showVisualBoard: p.showVisualBoard !== false,
        showSummary: p.showSummary !== false,
        showNotes: p.showNotes !== false,
        showCollaborators: p.showCollaborators !== false,
      });
    }
  }, [build, isEditing]);

  useEffect(() => {
    if (notesModalOpen && build) {
      setEditNotes(build.notes ?? "");
      setNotesError(null);
    }
  }, [notesModalOpen, build]);

  const nodeRowsForLink = useMemo(
    () =>
      nodeCatalog.map((node) => ({
        _id: node._id,
        name: node.name,
        category: node.category ?? "",
        tags: node.tags ?? [],
        _creationTime: node._creationTime,
        nodeType: node.nodeType,
        overallBucket: node.overallBucket,
        progressPercent: node.progressPercent,
        childCount: node.childCount,
        hasIncompleteDescendants: node.hasIncompleteDescendants,
        purchaseStatus: node.purchaseStatus,
        buildStatus: node.buildStatus,
        materialStatus: node.materialStatus,
        totalCostCents: node.totalCostCents,
      })),
    [nodeCatalog]
  );

  const photoKind = fabModal === "reference" || fabModal === "progress" ? fabModal : null;

  const handlePhotoSelected = useCallback(
    async (result: { imageStorageId?: Id<"_storage">; imageUrl?: string }) => {
      if (!id || !userId || !photoKind) return;
      const mutation = photoKind === "reference" ? addReferenceImage : addProgressPhoto;
      await mutation({
        buildId: id,
        userId,
        imageStorageId:
          "imageStorageId" in result && result.imageStorageId ? result.imageStorageId : undefined,
        imageUrl: "imageUrl" in result && result.imageUrl ? result.imageUrl : undefined,
      });
    },
    [id, userId, photoKind, addReferenceImage, addProgressPhoto]
  );

  const handleSaveEdit = async () => {
    if (!id || !userId || !build) return;
    setSavePending(true);
    // REQ-017: free users cannot publish; clamp visibility to private regardless of UI state.
    const effectiveVisibility = canPublish ? editVisibility : "private";
    const isPublished = effectiveVisibility === "public" || effectiveVisibility === "unlisted";
    try {
      await updateBuild({
        id,
        userId,
        name: editName.trim(),
        character: editCharacter.trim() || undefined,
        status: editStatus,
        budgetCents: editBudgetCents.trim()
          ? Math.round(parseFloat(editBudgetCents) * 100)
          : undefined,
        targetDate: editTargetDate.trim() || undefined,
        imageUrl: editImageUrl.trim() || null,
        imageStorageId: editImageStorageId,
        visibility: effectiveVisibility,
        publicViewerSettings: isPublished ? publicViewerToggles : undefined,
      });
      setIsEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !userId) return;
    setNotesSavePending(true);
    setNotesError(null);
    try {
      await updateBuild({
        id,
        userId,
        notes: editNotes.trim() || undefined,
      });
      setNotesModalOpen(false);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setNotesSavePending(false);
    }
  };

  const handleClearNotes = async () => {
    if (!id || !userId) return;
    setNotesSavePending(true);
    setNotesError(null);
    try {
      await updateBuild({ id, userId, notes: "" });
      setEditNotes("");
      setNotesModalOpen(false);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to clear notes");
    } finally {
      setNotesSavePending(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && userId) {
      const taskId = active.id as Id<"workflowItems">;
      const cosplayNodeId = over.id as CosplayNodeId;
      updateTask({ id: taskId, userId, cosplayNodeId });
      justDroppedRef.current = true;
      setTimeout(() => {
        justDroppedRef.current = false;
      }, 150);
    }
  };

  if (!id) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Missing build id.
          </p>
          <Link href="/builds" className="mt-4 inline-block text-sm underline">
            Back to Builds
          </Link>
        </div>
      </WebAppShell>
    );
  }

  if (build === undefined) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Loading...
          </p>
        </div>
      </WebAppShell>
    );
  }

  if (!build) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Build not found.
          </p>
          <Link href="/builds" className="mt-4 inline-block text-sm underline">
            Back to Builds
          </Link>
        </div>
      </WebAppShell>
    );
  }

  const getDaysRemaining = (targetDate: string | undefined) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining(build.targetDate);
  const detailFrameClass = "w-full";

  return (
    <WebAppShell fullBleed lockViewport>
      <div className="relative flex-1 flex flex-col min-h-0 text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={build.imageStorageId}
          imageUrl={build.imageUrl}
          scrimRight="strong"
          objectPosition={
            build.imageFocalX != null && build.imageFocalY != null
              ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
              : undefined
          }
        />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href="/builds"
            aria-label="Back to builds"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1" />
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Open build summary tab"
              >
                <span className="material-symbols-outlined font-light text-[22px]">summarize</span>
              </button>
              <button
                type="button"
                onClick={() => setNotesModalOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Open build notes"
              >
                <span className="material-symbols-outlined font-light text-[22px]">
                  description
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Edit build"
              >
                <span className="material-symbols-outlined font-light text-[22px]">edit</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg"
            >
              Cancel
            </button>
          )}
        </div>

        <main className="relative z-10 mx-auto mb-6 mt-4 flex w-full min-h-0 max-w-[1600px] flex-1 flex-col px-4 sm:px-6 lg:px-10">
          {isEditing ? (
            <div className="mx-auto w-full max-w-3xl space-y-10 bg-glass backdrop-blur-glass border border-glass-border rounded-glass p-6 sm:p-8 lg:max-h-full lg:overflow-y-auto">
              <div className="border-b border-glass-divider-strong pb-8 text-center">
                <h1 className="font-serif italic text-4xl tracking-tight">Edit Project</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-media-fg-55">
                  Settings &amp; Metadata
                </p>
              </div>

              <div className="grid grid-cols-1 gap-10 md:grid-cols-[240px_1fr] lg:gap-16">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                    Cover Image
                  </label>
                  <ImageUpload
                    category="builds"
                    onImageSelected={(result) => {
                      if ("imageStorageId" in result && result.imageStorageId) {
                        setEditImageStorageId(result.imageStorageId);
                        setEditImageUrl("");
                      } else {
                        setEditImageUrl(result.imageUrl ?? "");
                        setEditImageStorageId(null);
                      }
                    }}
                    currentImage={editImageUrl || undefined}
                    currentStorageId={editImageStorageId ?? undefined}
                  />
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border-0 border-b border-glass-border-strong bg-transparent py-3 text-3xl font-serif italic tracking-tight placeholder:text-media-fg-55 focus:border-kyar-media-fg focus:outline-none focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                      Character (optional)
                    </label>
                    <input
                      type="text"
                      value={editCharacter}
                      onChange={(e) => setEditCharacter(e.target.value)}
                      placeholder="e.g. Arlecchino"
                      className="w-full border-0 border-b border-glass-border bg-transparent py-2 text-base placeholder:text-media-fg-55 focus:border-kyar-media-fg focus:outline-none focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                      Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditStatus(s)}
                          className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                            editStatus === s
                              ? "bg-glass-solid text-glass-ink"
                              : "border border-glass-border-strong text-kyar-media-fg opacity-60 hover:opacity-90"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                        Budget $ (optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editBudgetCents}
                        onChange={(e) => setEditBudgetCents(e.target.value)}
                        placeholder="0.00"
                        className="w-full border-0 border-b border-glass-border bg-transparent py-2 text-base placeholder:text-media-fg-55 focus:border-kyar-media-fg focus:outline-none focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                        Deadline (optional)
                      </label>
                      <input
                        type="date"
                        value={editTargetDate}
                        onChange={(e) => setEditTargetDate(e.target.value)}
                        className="w-full border-0 border-b border-glass-border bg-transparent py-2 text-base focus:border-kyar-media-fg focus:outline-none focus-visible:ring-0 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                      Visibility
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["private", "unlisted", "public"] as const).map((v) => {
                        // REQ-017: unlisted/public require a paid tier; private stays free.
                        const gated = !canPublish && v !== "private";
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setEditVisibility(v)}
                            disabled={gated}
                            aria-disabled={gated}
                            title={gated ? "Publishing is a paid feature" : undefined}
                            className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              editVisibility === v
                                ? "bg-glass-solid text-glass-ink"
                                : "border border-glass-border-strong text-kyar-media-fg opacity-60 hover:opacity-90"
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-media-fg-55">
                      Private: only you. Unlisted: anyone with link. Public: on your profile.
                    </p>
                    {!canPublish && (
                      <UpgradePrompt
                        className="mt-4"
                        message="Publishing a build publicly is a paid feature. Your build stays private and on your device until you upgrade."
                        linkText="View plan"
                      />
                    )}
                    {(editVisibility === "public" || editVisibility === "unlisted") && (
                      <div className="mt-8 space-y-3 border-t border-glass-divider pt-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                          Shared page sections
                        </p>
                        <p className="text-xs leading-relaxed text-media-fg-55">
                          These apply to the public URL and unlisted share links for this build.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(
                            [
                              ["showExplorer", "Explorer (outline & notes block)"],
                              ["showNotes", "Notes in explorer"],
                              ["showTasks", "Tasks & timeline"],
                              ["showVisualBoard", "Visual board (refs, progress, elements)"],
                              ["showSummary", "Summary stats"],
                              ["showCollaborators", "Collaborators"],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-glass-border bg-glass-active px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={publicViewerToggles[key]}
                                onChange={(e) =>
                                  setPublicViewerToggles((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 border-t border-glass-divider pt-6">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={savePending || !editName.trim()}
                      className="flex-1 rounded-full bg-glass-solid py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savePending ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={savePending}
                      className="rounded-full border border-glass-border-strong bg-glass-bar px-8 py-4 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full min-h-0 flex-1 flex-col gap-6">
              <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] lg:items-stretch">
                {/* Identity on the photo, left (6b) */}
                <div className="max-w-[720px] pt-2 lg:pt-8">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em] opacity-75">
                    The archive ▸ {build.character || build.name} · {build.status}
                  </p>
                  <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] sm:text-[56px] lg:text-[72px]">
                    {build.name}
                  </h1>

                  {summary && (
                    <div className="mt-7 flex items-center gap-4">
                      <span
                        className="relative h-px w-40 bg-kyar-media-fg/25 sm:w-52"
                        aria-hidden
                      >
                        <span
                          className="absolute inset-y-0 left-0 bg-kyar-media-fg"
                          style={{ width: `${Math.min(100, Math.max(0, summary.progressPercent))}%` }}
                        />
                      </span>
                      <span className="text-[11px] font-bold tabular-nums">
                        {summary.progressPercent}%
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                        {summary.tasksChecked} / {summary.tasksTotal} tasks
                      </span>
                    </div>
                  )}

                  <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
                    {build.character && (
                      <div>
                        <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                          Character
                        </dt>
                        <dd className="text-[15px]">{build.character}</dd>
                      </div>
                    )}
                    {build.targetDate && daysRemaining !== null && (
                      <div>
                        <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                          Deadline
                        </dt>
                        <dd
                          className={`text-[15px] ${
                            daysRemaining < 0
                              ? "text-on-glass-danger"
                              : daysRemaining <= 7
                                ? "text-on-glass-chip-warn-fg"
                                : ""
                          }`}
                        >
                          {new Date(build.targetDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          ·{" "}
                          {daysRemaining < 0
                            ? `${Math.abs(daysRemaining)}d overdue`
                            : daysRemaining === 0
                              ? "Due today"
                              : `${daysRemaining}d left`}
                        </dd>
                      </div>
                    )}
                    {summary && (
                      <div>
                        <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                          Spend
                        </dt>
                        <dd className="text-[15px] tabular-nums">
                          {formatCents(summary.totalCostCents)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Work panel with tabs, anchored right (6b) */}
                <section className="flex min-h-0 flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass lg:h-full lg:overflow-hidden">
                <nav className="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-4 border-b border-glass-divider-strong overflow-x-auto">
                  {(
                    [
                      ["explorer", "Elements"],
                      ["tasks", "Tasks"],
                      ["progress", "Updates"],
                      ["summary", "Summary"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActiveTab(value)}
                      aria-pressed={activeTab === value}
                      className={`text-[10px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        activeTab === value
                          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
                  {activeTab === "explorer" && (
                    <div className={`${detailFrameClass} flex min-h-0 flex-1 flex-col gap-8`}>
                      {build.notes && (
                        <section className="shrink-0 border-l-2 border-glass-border-strong pl-5">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                            Notes
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-media-fg-70">
                            {build.notes}
                          </p>
                        </section>
                      )}
                      <section className="flex min-h-0 flex-1 flex-col border-t border-glass-divider pt-4">
                        <BuildNodeManagerSection
                          buildId={id}
                          buildName={build.name}
                          userId={userId}
                          linkedNodes={linkedNodes}
                          linkedNodeIds={linkedNodeIds}
                          onOpenLinkNodes={() => setFabModal("linkNodes")}
                          onCreateRoot={() =>
                            openCreationModal("newCloset", {
                              successRedirectTo: null,
                              onCreated: async (node) => {
                                if (!userId) return;
                                await linkNodes({
                                  userId,
                                  buildId: id,
                                  cosplayNodeIds: [...linkedNodeIds, node._id],
                                });
                              },
                            })
                          }
                          onCreateChild={(parentId, initialNodeType) =>
                            openCreationModal("newCloset", {
                              initialNodeType,
                              initialCategory:
                                initialNodeType === "material" ? "material" : "other",
                              successRedirectTo: null,
                              onCreated: async (node) => {
                                if (!userId) return;
                                await addChildLink({
                                  userId,
                                  parentNodeId: parentId,
                                  childNodeId: node._id,
                                  linkMode: "owned",
                                });
                              },
                            })
                          }
                        />
                      </section>
                    </div>
                  )}

                  {activeTab === "tasks" && (
                    <section id="build-tasks" className={detailFrameClass}>
                      <h2 className="mb-6 font-serif italic text-2xl">Tasks &amp; Timeline</h2>
                      <WorkflowTree buildId={id} userId={userId} />
                    </section>
                  )}

                  {activeTab === "progress" && (
                    <section className={detailFrameClass}>
                      <BuildProgressTimeline buildId={id} userId={userId} />
                    </section>
                  )}

                  {activeTab === "summary" && (
                    <section className={detailFrameClass}>
                      <div className="grid gap-6">
                        <div>
                          <BuildSummarySection
                            summary={summary ?? null}
                            formatCents={formatCents}
                          />
                        </div>
                        <div className="rounded-glass border border-glass-border bg-glass-active p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                                Collaborators
                              </p>
                              <h2 className="mt-2 font-serif italic text-2xl">Team</h2>
                            </div>
                            {userId && build.userId === userId && (
                              <button
                                type="button"
                                onClick={() => setFabModal("invite")}
                                className="rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
                              >
                                Invite
                              </button>
                            )}
                          </div>
                          <div className="mt-5 space-y-3">
                            {collaborators.length > 0 ? (
                              collaborators.map((c) => (
                                <div
                                  key={c.userId}
                                  className="flex items-center justify-between gap-3 rounded-[10px] border border-glass-border px-4 py-3"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass text-xs font-serif">
                                      {(c.name ?? c.email ?? c.userId).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">
                                        {c.name ?? c.email ?? c.userId}
                                      </p>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                                        {c.role}
                                      </p>
                                    </div>
                                  </div>
                                  {userId && build.userId === userId && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeCollaborator({
                                          buildId: id,
                                          ownerId: userId,
                                          userId: c.userId,
                                        })
                                      }
                                      className="text-[10px] uppercase tracking-[0.16em] text-on-glass-danger/70 hover:text-on-glass-danger"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-media-fg-55">No collaborators yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
                </section>
              </div>

              {/* Board gallery strip along the bottom (6b) */}
              {(() => {
                const stripImages = [
                  ...boardReferenceImages.map((img) => ({
                    key: `ref-${img._id}`,
                    imageStorageId: img.imageStorageId,
                    imageUrl: img.imageUrl,
                  })),
                  ...boardProcessPictures.map((img) => ({
                    key: `proc-${img._id}`,
                    imageStorageId: img.imageStorageId,
                    imageUrl: img.imageUrl,
                  })),
                ].slice(0, 6);
                const pinCount = boardReferenceImages.length + boardProcessPictures.length;
                return (
                  <div className="shrink-0 pt-2">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                        Board · References + process · {pinCount}
                      </p>
                      <button
                        type="button"
                        onClick={() => setBoardOpen(true)}
                        className="border-b border-glass-border-strong pb-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        Open board
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {stripImages.map((img) => (
                        <button
                          key={img.key}
                          type="button"
                          onClick={() => setBoardOpen(true)}
                          className="relative h-[88px] w-[124px] shrink-0 overflow-hidden rounded-[10px] border border-glass-border focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          aria-label="Open board"
                        >
                          <ResolvedImage
                            imageStorageId={img.imageStorageId ?? undefined}
                            imageUrl={img.imageUrl ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                      {userId && (
                        <button
                          type="button"
                          onClick={() => setFabModal("reference")}
                          className="flex h-[88px] w-[124px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-kyar-media-ring text-media-fg-70 transition-colors hover:border-glass-border-strong hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          aria-label="Add a board image"
                        >
                          <span className="material-symbols-outlined text-xl" aria-hidden>
                            add
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {/* Board — full-screen overlay over the dimmed studio (opened from the gallery strip) */}
        {boardOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div
              className="absolute inset-0 bg-scrim-dim backdrop-blur-[2px]"
              onClick={() => setBoardOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-label="Visual board"
              className="relative z-10 m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-glass-overlay border border-glass-border-overlay bg-glass-overlay-on-wall shadow-glass-overlay backdrop-blur-glass-overlay text-kyar-media-fg sm:m-6"
            >
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-glass-divider px-5 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
                  Board · References + process
                </p>
                <button
                  type="button"
                  onClick={() => setBoardOpen(false)}
                  aria-label="Close board"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-media-fg-55 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <DndContext onDragEnd={handleDragEnd}>
                  <BuildVisualBoard
                    buildId={id}
                    userId={userId}
                    prefetchedReferenceImages={boardReferenceImages}
                    prefetchedProcessPictures={boardProcessPictures}
                    linkedNodes={visualBoardNodes}
                    onOpenLinkNodes={() => {
                      if (userId) setFabModal("linkNodes");
                    }}
                    renderNodeCard={(item) => {
                      const nodeItem = item as LinkedNode;
                      return (
                        <DroppableNodeCard item={nodeItem} justDroppedRef={justDroppedRef}>
                          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[12px] border border-glass-border bg-glass-active">
                            {nodeItem.imageStorageId || nodeItem.imageUrl ? (
                              <ResolvedImage
                                imageStorageId={nodeItem.imageStorageId ?? undefined}
                                imageUrl={nodeItem.imageUrl ?? undefined}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-media-fg-45">
                                <span className="material-symbols-outlined text-3xl" aria-hidden>
                                  {nodeItem.nodeType === "material" ? "science" : "checkroom"}
                                </span>
                              </span>
                            )}
                            <span
                              className="absolute inset-0 bg-kyar-media-scrim-heavy"
                              aria-hidden
                            />
                            <span className="absolute inset-x-3 bottom-2.5 truncate font-serif text-[15px] italic text-kyar-media-fg">
                              {nodeItem.name}
                            </span>
                          </div>
                        </DroppableNodeCard>
                      );
                    }}
                  />
                </DndContext>
              </div>
            </div>
          </div>
        )}

        <BuildNotesModal
          open={notesModalOpen}
          notes={editNotes}
          onNotesChange={setEditNotes}
          onSave={handleSaveNotes}
          onClear={handleClearNotes}
          onClose={() => !notesSavePending && setNotesModalOpen(false)}
          saving={notesSavePending}
          error={notesError}
        />
        <BuildPhotoBatchModal
          open={photoKind != null}
          kind={photoKind}
          onClose={() => setFabModal(null)}
          onImageSelected={handlePhotoSelected}
        />

        {userId && (
          <BuildLinkClosetModal
            open={fabModal === "linkNodes"}
            onClose={() => setFabModal(null)}
            buildId={id}
            userId={userId}
            closetItems={nodeRowsForLink}
            linkedIds={linkedNodeIds}
          />
        )}

        {userId && (
          <BuildAddTaskModal
            open={fabModal === "task"}
            onClose={() => setFabModal(null)}
            buildId={id}
            userId={userId}
            taskCount={tasks.length}
          />
        )}

        {userId && build.userId === userId && (
          <BuildInviteCollaboratorModal
            open={fabModal === "invite"}
            onClose={() => setFabModal(null)}
            buildId={id}
            ownerId={userId}
          />
        )}
      </div>
    </WebAppShell>
  );
}

function DroppableNodeCard({
  item,
  justDroppedRef,
  children,
}: {
  item: { _id: CosplayNodeId; name: string };
  justDroppedRef: React.MutableRefObject<boolean>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: item._id,
    data: { type: "cosplayNode" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${isOver ? "scale-105 shadow-lg ring-2 ring-kyar-accent" : ""}`}
    >
      <Link
        href={`/elements/${item._id}`}
        className="block cursor-pointer rounded-sm transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
        aria-label={`View ${item.name}`}
        onClick={(e) => {
          if (justDroppedRef.current) {
            e.preventDefault();
          }
        }}
      >
        {children}
      </Link>
    </div>
  );
}
