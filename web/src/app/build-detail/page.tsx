"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { TaskChecklist, type BuildTask } from "@/components/builds/TaskChecklist";
import { WorkflowTree } from "@/components/builds/WorkflowTree";
import { BuildNotesModal } from "@/components/builds/BuildNotesModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ClosetCarouselCardContent } from "@/components/ui/closet-items-carousel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { BuildVisualBoard, type BuildVisualBoardNode } from "@/components/builds/BuildVisualBoard";
import { BuildDetailFab, type BuildDetailFabModal } from "@/components/builds/BuildDetailFab";
import { BuildPhotoBatchModal } from "@/components/builds/BuildPhotoBatchModal";
import { BuildLinkClosetModal } from "@/components/builds/BuildLinkClosetModal";
import { BuildAddTaskModal } from "@/components/builds/BuildAddTaskModal";
import { BuildInviteCollaboratorModal } from "@/components/builds/BuildInviteCollaboratorModal";
import { BuildNodeManagerSection } from "@/components/builds/BuildNodeManagerSection";
import { BuildSummarySection } from "@/components/builds/BuildSummarySection";
import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree";
import { formatNodeStatus, formatNodeTypeLabel } from "@/lib/cosplayUi";
import { useCreationModals } from "@/contexts/CreationModalsContext";

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

type DetailedLinkedNode = LinkedNode & {
  children: Array<
    LinkedNode & {
      _id: CosplayNodeId;
      linkId: Id<"cosplayNodeLinks">;
      linkMode: "owned" | "reference";
      sortOrder: number;
    }
  >;
};

type NodeSelectionMeta = {
  nodeId: CosplayNodeId;
  isRoot: boolean;
  rootIndex?: number;
  parentNodeId?: CosplayNodeId;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export default function BuildDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as Id<"builds"> | null;
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();

  const build = useQuery(api.builds.get, id ? { id } : "skip");
  const summary = useQuery(api.builds.getSummary, id && userId ? { buildId: id, userId } : "skip");
  const linkedNodeIds = (useQuery(api.builds.getNodes, id ? { buildId: id } : "skip") ??
    []) as CosplayNodeId[];
  const nodeCatalog =
    (useQuery(
      api.cosplayNodes.list,
      userId && id ? { userId, buildId: id, sortBy: "name" } : "skip"
    ) ?? []) as LinkedNode[];
  const tasks = useQuery(api.buildTasks.listByBuild, id ? { buildId: id } : "skip") ?? [];

  const updateTask = useMutation(api.buildTasks.update);
  const updateBuild = useMutation(api.builds.update);
  const linkNodes = useMutation(api.builds.linkNodes);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const collaborators =
    useQuery(api.buildCollaborators.listByBuild, id ? { buildId: id } : "skip") ?? [];
  const removeCollaborator = useMutation(api.buildCollaborators.remove);
  const addReferenceImage = useMutation(api.buildReferenceImages.add);
  const addProgressPhoto = useMutation(api.buildProcessPictures.add);
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
  const [fabModal, setFabModal] = useState<BuildDetailFabModal | null>(null);
  const [activeTab, setActiveTab] = useState<"explorer" | "tasks" | "board" | "summary">(
    "explorer"
  );

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
    }
  }, [build, isEditing]);

  useEffect(() => {
    if (notesModalOpen && build) {
      setEditNotes(build.notes ?? "");
      setNotesError(null);
    }
  }, [notesModalOpen, build]);

  const linkedNodes = useMemo(() => {
    const byId = new Map(nodeCatalog.map((node) => [node._id, node]));
    return linkedNodeIds
      .map((nodeId) => byId.get(nodeId))
      .filter((node): node is LinkedNode => Boolean(node));
  }, [linkedNodeIds, nodeCatalog]);

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
        imageUrl: editImageUrl.trim() || undefined,
        imageStorageId: editImageStorageId ?? undefined,
        visibility: editVisibility,
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
      <WebAppShell>
        <p className="meta-label pt-12">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </WebAppShell>
    );
  }

  if (build === undefined) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading...</p>
      </WebAppShell>
    );
  }

  if (!build) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Build not found.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
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

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <WebAppShell>
        <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-kyar-borderSubtle bg-kyar-bg/95 pb-4 pt-12 backdrop-blur-md">
          <Link href="/builds" aria-label="Back to builds">
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[11px] uppercase tracking-widest text-kyar-textTertiary">
            {build.name}
          </span>
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className="p-1 text-kyar-textTertiary transition-colors hover:text-kyar-accent"
                aria-label="Open build summary tab"
              >
                <span className="material-symbols-outlined font-light text-[22px]">summarize</span>
              </button>
              <button
                type="button"
                onClick={() => setNotesModalOpen(true)}
                className="p-1 text-kyar-textTertiary transition-colors hover:text-kyar-accent"
                aria-label="Open build notes"
              >
                <span className="material-symbols-outlined font-light text-[22px]">
                  description
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1 text-kyar-textTertiary transition-colors hover:text-kyar-accent"
                aria-label="Edit build"
              >
                <span className="material-symbols-outlined font-light text-[22px]">edit</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-[10px] font-bold uppercase tracking-widest text-kyar-textTertiary hover:text-black"
            >
              Cancel
            </button>
          )}
        </header>

        <main className="mx-auto mb-16 mt-6 max-w-[1600px] px-4 sm:px-6 lg:px-8">
          {isEditing ? (
            <div className="mx-auto max-w-3xl space-y-12">
              <div className="border-b border-kyar-borderSubtle pb-8 text-center">
                <h1 className="font-serif text-4xl tracking-tight text-kyar-text">Edit Project</h1>
                <p className="text-sm uppercase tracking-widest text-kyar-textTertiary">
                  Settings &amp; Metadata
                </p>
              </div>

              <div className="grid grid-cols-1 gap-10 md:grid-cols-[240px_1fr] lg:gap-16">
                <div className="space-y-4">
                  <label className="block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
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
                    <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border-0 border-b border-kyar-text/30 bg-transparent py-3 text-3xl font-serif tracking-tight placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                      Character (optional)
                    </label>
                    <input
                      type="text"
                      value={editCharacter}
                      onChange={(e) => setEditCharacter(e.target.value)}
                      placeholder="e.g. Arlecchino"
                      className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                      Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditStatus(s)}
                          className={`border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                            editStatus === s
                              ? "border-kyar-text bg-kyar-text text-white"
                              : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text hover:text-kyar-text"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                        Budget $ (optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editBudgetCents}
                        onChange={(e) => setEditBudgetCents(e.target.value)}
                        placeholder="0.00"
                        className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                        Deadline (optional)
                      </label>
                      <input
                        type="date"
                        value={editTargetDate}
                        onChange={(e) => setEditTargetDate(e.target.value)}
                        className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base focus:border-kyar-text focus:outline-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary">
                      Visibility
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["private", "unlisted", "public"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEditVisibility(v)}
                          className={`border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                            editVisibility === v
                              ? "border-kyar-text bg-kyar-text text-white"
                              : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text hover:text-kyar-text"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-kyar-textTertiary">
                      Private: only you. Unlisted: anyone with link. Public: on your profile.
                    </p>
                  </div>
                  <div className="flex gap-4 border-t border-kyar-borderSubtle pt-6">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={savePending || !editName.trim()}
                      className="flex-1 bg-kyar-text py-4 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savePending ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={savePending}
                      className="border border-kyar-borderSubtle px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-kyar-text disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-kyar-textTertiary">
                  <span>Kyarafit</span>
                  {build.character && (
                    <>
                      <span className="opacity-40">/</span>
                      <span>{build.character}</span>
                    </>
                  )}
                </div>

                <div className="relative mb-6 overflow-hidden rounded-md shadow-sm">
                  {build.imageStorageId ? (
                    <div className="relative aspect-[16/9] w-full bg-kyar-mutedWarm sm:aspect-[21/9]">
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
                    </div>
                  ) : build.imageUrl ? (
                    <div className="relative aspect-[16/9] w-full bg-kyar-mutedWarm sm:aspect-[21/9]">
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
                    </div>
                  ) : null}

                  <div
                    className={`${
                      build.imageStorageId || build.imageUrl
                        ? "absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end bg-gradient-to-t from-white via-white/50 to-transparent px-6 pb-6 pt-32 sm:items-start sm:px-10"
                        : ""
                    }`}
                  >
                    <h1 className="text-center font-serif text-5xl font-bold leading-[0.9] tracking-tight text-kyar-text sm:text-left sm:text-6xl lg:text-7xl">
                      {build.name}
                    </h1>
                  </div>
                </div>

                {build.targetDate && daysRemaining !== null && (
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-kyar-textTertiary">
                      Deadline
                    </span>
                    <span className="h-3 w-px bg-kyar-borderSubtle"></span>
                    <span className="font-medium text-kyar-text">
                      {new Date(build.targetDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={`ml-1 text-xs ${
                        daysRemaining < 0
                          ? "text-red-600"
                          : daysRemaining <= 7
                            ? "text-orange-600"
                            : "text-kyar-textTertiary"
                      }`}
                    >
                      (
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)} days overdue`
                        : daysRemaining === 0
                          ? "Due today!"
                          : `${daysRemaining} days remaining`}
                      )
                    </span>
                  </div>
                )}
              </div>

              <nav className="flex flex-wrap gap-2 border-t border-kyar-borderSubtle pt-4">
                {([
                  ["explorer", "Explorer"],
                  ["tasks", "Tasks"],
                  ["board", "Visual board"],
                  ["summary", "Summary"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value)}
                    className={`rounded-full border px-4 py-2 text-[10px] uppercase tracking-widest transition-colors ${
                      activeTab === value
                        ? "border-black bg-black text-white"
                        : "border-kyar-borderSubtle text-kyar-textTertiary hover:border-black hover:text-black"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {activeTab === "explorer" && (
                <div className="space-y-8">
                  {build.notes && (
                    <section className="border-l-2 border-kyar-text/20 pl-5">
                      <p className="mb-3 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        Notes
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-kyar-textSecondary">
                        {build.notes}
                      </p>
                    </section>
                  )}
                  <section className="border-t border-kyar-borderSubtle pt-4">
                    <BuildNodeManagerSection
                      buildId={id}
                      userId={userId}
                      linkedNodes={linkedNodes}
                      linkedNodeIds={linkedNodeIds}
                      tasks={tasks}
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
                          initialCategory: initialNodeType === "material" ? "material" : "other",
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
                      onMoveRoot={async (fromIndex, toIndex) => {
                        if (!userId || toIndex < 0 || toIndex >= linkedNodeIds.length) return;
                        const ordered = [...linkedNodeIds];
                        const [moved] = ordered.splice(fromIndex, 1);
                        if (!moved) return;
                        ordered.splice(toIndex, 0, moved);
                        await linkNodes({ userId, buildId: id, cosplayNodeIds: ordered });
                      }}
                    />
                  </section>
                </div>
              )}

              {activeTab === "tasks" && (
                <section id="build-tasks" className="border-t border-kyar-borderSubtle pt-4">
                  <h2 className="mb-6 font-serif text-2xl text-kyar-text">Tasks &amp; Timeline</h2>
                  <WorkflowTree buildId={id} userId={userId} />
                </section>
              )}

              {activeTab === "board" && (
                <section className="border-t border-kyar-borderSubtle pt-4">
                  <BuildVisualBoard
                    buildId={id}
                    userId={userId}
                    linkedNodes={linkedNodes}
                    onOpenLinkNodes={() => {
                      if (userId) setFabModal("linkNodes");
                    }}
                    renderNodeCard={(item) => {
                      const nodeItem = item as LinkedNode;
                      return (
                        <DroppableNodeCard item={nodeItem} justDroppedRef={justDroppedRef}>
                          <ClosetCarouselCardContent
                            item={{
                              ...nodeItem,
                              costCents: nodeItem.totalCostCents ?? nodeItem.directCostCents ?? null,
                            }}
                            formatCents={formatCents}
                          />
                        </DroppableNodeCard>
                      );
                    }}
                  />
                </section>
              )}

              {activeTab === "summary" && (
                <section className="border-t border-kyar-borderSubtle pt-4">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      <BuildSummarySection summary={summary ?? null} formatCents={formatCents} />
                    </div>
                    <div className="rounded-[24px] border border-kyar-borderSubtle bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                            Collaborators
                          </p>
                          <h2 className="mt-2 font-serif text-2xl text-kyar-text">Team</h2>
                        </div>
                        {userId && build.userId === userId && (
                          <button
                            type="button"
                            onClick={() => setFabModal("invite")}
                            className="rounded-full border border-kyar-borderSubtle px-4 py-2 text-[10px] uppercase tracking-widest"
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
                              className="flex items-center justify-between gap-3 rounded-2xl border border-kyar-borderSubtle px-4 py-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-muted text-xs font-serif text-kyar-text">
                                  {(c.name ?? c.email ?? c.userId).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-kyar-text">
                                    {c.name ?? c.email ?? c.userId}
                                  </p>
                                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
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
                                  className="text-[10px] uppercase tracking-widest text-red-600/70 hover:text-red-600"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-kyar-textTertiary">No collaborators yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

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
        <BuildDetailFab
          hidden={isEditing}
          userId={userId}
          showInviteCollaborator={!!userId && build.userId === userId}
          onOpenModal={setFabModal}
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
      </WebAppShell>
    </DndContext>
  );
}

function bucketLabel(bucket: LinkedNode["overallBucket"]) {
  if (bucket === "complete") return "Complete";
  if (bucket === "in_progress") return "In Progress";
  return "Incomplete";
}

function nodeIcon(nodeType?: LinkedNode["nodeType"]) {
  return (
    <span className="material-symbols-outlined text-lg">
      {nodeType === "material" ? "inventory_2" : "checkroom"}
    </span>
  );
}

function BuildNodeExplorerSection({
  buildId,
  userId,
  linkedNodes,
  linkedNodeIds,
  onOpenLinkNodes,
  onCreateRoot,
  onCreateChild,
  onMoveRoot,
}: {
  buildId: Id<"builds">;
  userId: string | null;
  linkedNodes: LinkedNode[];
  linkedNodeIds: CosplayNodeId[];
  onOpenLinkNodes: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
  onMoveRoot: (fromIndex: number, toIndex: number) => Promise<void>;
}) {
  const grouped = useMemo(() => {
    const groups: Array<{
      bucket: LinkedNode["overallBucket"];
      nodes: Array<{ node: LinkedNode; rootIndex: number }>;
    }> = [
      { bucket: "incomplete", nodes: [] },
      { bucket: "in_progress", nodes: [] },
      { bucket: "complete", nodes: [] },
    ];
    linkedNodes.forEach((node) => {
      const rootIndex = linkedNodeIds.findIndex((id) => id === node._id);
      const group = groups.find((entry) => entry.bucket === (node.overallBucket ?? "incomplete"));
      (group ?? groups[0]).nodes.push({ node, rootIndex });
    });
    return groups.filter((group) => group.nodes.length > 0);
  }, [linkedNodes, linkedNodeIds]);

  return (
    <div className="rounded-[28px] border border-kyar-borderSubtle bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
            Node Explorer
          </p>
          <h2 className="font-serif text-3xl text-kyar-text">Linked nodes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-kyar-textSecondary">
            Expand the hierarchy to manage structure, drag tasks onto a node row to assign them,
            and use this section to create roots or children without leaving the build workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateRoot}
            className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            New root node
          </button>
          <button
            type="button"
            onClick={onOpenLinkNodes}
            className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            Link existing
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-kyar-borderSubtle px-5 py-8 text-sm text-kyar-textTertiary">
          No linked nodes yet. Create a root node or link an existing element or material to start
          building the structure for this project.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.bucket} className="rounded-2xl border border-kyar-borderSubtle/70">
              <div className="border-b border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                      {bucketLabel(group.bucket)}
                    </p>
                    <p className="text-sm text-kyar-textSecondary">
                      {group.nodes.length} root node{group.nodes.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
              <TreeProvider defaultExpandedIds={group.nodes.map(({ node }) => String(node._id))}>
                <TreeView>
                  {group.nodes.map(({ node, rootIndex }, index) => (
                    <BuildNodeTreeRow
                      key={node._id}
                      buildId={buildId}
                      nodeId={node._id as CosplayNodeId}
                      node={node}
                      level={0}
                      isLast={index === group.nodes.length - 1}
                      userId={userId}
                      onCreateChild={onCreateChild}
                      onMoveUp={
                        rootIndex > 0 ? () => onMoveRoot(rootIndex, rootIndex - 1) : undefined
                      }
                      onMoveDown={
                        rootIndex < linkedNodeIds.length - 1
                          ? () => onMoveRoot(rootIndex, rootIndex + 1)
                          : undefined
                      }
                    />
                  ))}
                </TreeView>
              </TreeProvider>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuildNodeTreeRow({
  buildId,
  nodeId,
  node,
  level,
  isLast,
  userId,
  onCreateChild,
  onMoveUp,
  onMoveDown,
}: {
  buildId: Id<"builds">;
  nodeId: CosplayNodeId;
  node: LinkedNode;
  level: number;
  isLast?: boolean;
  userId: string | null;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
  onMoveUp?: () => Promise<void> | void;
  onMoveDown?: () => Promise<void> | void;
}) {
  const detail = useQuery(api.cosplayNodes.get, { id: nodeId, buildId }) as
    | (LinkedNode & {
        children: Array<
          LinkedNode & {
            _id: CosplayNodeId;
            linkId: Id<"cosplayNodeLinks">;
            linkMode: "owned" | "reference";
            sortOrder: number;
          }
        >;
      })
    | null
    | undefined;
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const { setNodeRef, isOver } = useDroppable({
    id: nodeId,
    data: { type: "cosplayNode" },
  });
  const children = detail?.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <TreeNode nodeId={String(nodeId)} level={level} isLast={isLast} hasChildren={hasChildren}>
      <TreeNodeTrigger>
        <div
          ref={setNodeRef}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 ${
            isOver ? "bg-kyar-accent/10 ring-1 ring-kyar-accent" : ""
          }`}
        >
          <TreeExpander hasChildren={hasChildren} />
          <TreeIcon hasChildren={hasChildren} icon={nodeIcon(detail?.nodeType ?? node.nodeType)} />
          <TreeLabel>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate font-medium text-kyar-text">
                {detail?.name ?? node.name}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                {formatNodeTypeLabel(detail?.nodeType ?? node.nodeType)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                {formatNodeStatus(detail ?? node)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                {(detail?.progressPercent ?? node.progressPercent ?? 0)}% progress
              </span>
              {hasChildren && (
                <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                  {children.length} child{children.length === 1 ? "" : "ren"}
                </span>
              )}
            </div>
          </TreeLabel>
          <div className="hidden shrink-0 items-center gap-2 text-right md:flex">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                Rollup
              </p>
              <p className="text-sm font-medium text-kyar-text">
                {detail?.totalCostCents != null
                  ? formatCents(detail.totalCostCents)
                  : node.totalCostCents != null
                    ? formatCents(node.totalCostCents)
                    : "—"}
              </p>
            </div>
            {userId && (
              <>
                {onMoveUp && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onMoveUp();
                    }}
                    className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                  >
                    Up
                  </button>
                )}
                {onMoveDown && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onMoveDown();
                    }}
                    className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                  >
                    Down
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateChild(
                      nodeId,
                      (detail?.nodeType ?? node.nodeType) === "material" ? "material" : "element"
                    );
                  }}
                  className="rounded-full border border-black px-3 py-2 text-[10px] uppercase tracking-widest"
                >
                  Add child
                </button>
                <Link
                  href={`/elements/${nodeId}`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                >
                  Open
                </Link>
              </>
            )}
          </div>
        </div>
      </TreeNodeTrigger>
      <TreeNodeContent hasChildren={hasChildren}>
        <div className="pl-6">
          {children.map((child, index) => (
            <BuildNodeTreeRow
              key={child._id}
              buildId={buildId}
              nodeId={child._id}
              node={child}
              level={level + 1}
              isLast={index === children.length - 1}
              userId={userId}
              onCreateChild={onCreateChild}
              onMoveUp={
                userId && index > 0
                  ? async () => {
                      const ordered = children.map((entry) => entry.linkId);
                      const [moved] = ordered.splice(index, 1);
                      if (!moved) return;
                      ordered.splice(index - 1, 0, moved);
                      await reorderChildren({ parentNodeId: nodeId, userId, orderedLinkIds: ordered });
                    }
                  : undefined
              }
              onMoveDown={
                userId && index < children.length - 1
                  ? async () => {
                      const ordered = children.map((entry) => entry.linkId);
                      const [moved] = ordered.splice(index, 1);
                      if (!moved) return;
                      ordered.splice(index + 1, 0, moved);
                      await reorderChildren({ parentNodeId: nodeId, userId, orderedLinkIds: ordered });
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </TreeNodeContent>
    </TreeNode>
  );
}

function DroppableNodeCard({
  item,
  justDroppedRef,
  children,
}: {
  item: { _id: Id<"closetItems"> | CosplayNodeId; name: string };
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
        className="block cursor-pointer rounded-sm transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2"
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
