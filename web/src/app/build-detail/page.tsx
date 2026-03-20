"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { TaskChecklist } from "@/components/builds/TaskChecklist";
import { BuildNotesModal } from "@/components/builds/BuildNotesModal";
import { BuildSummaryModal } from "@/components/builds/BuildSummaryModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ClosetCarouselCardContent } from "@/components/ui/closet-items-carousel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildStatus } from "@kyarafit/design-system/types";

// New Editorial Components
import {
  EditorialProgressDonut,
  EditorialHorizontalProgressRail,
} from "@/components/builds/EditorialBuildProgress";
import { BuildVisualBoard } from "@/components/builds/BuildVisualBoard";
import { BuildDetailFab, type BuildDetailFabModal } from "@/components/builds/BuildDetailFab";
import { BuildPhotoBatchModal } from "@/components/builds/BuildPhotoBatchModal";
import { BuildLinkClosetModal } from "@/components/builds/BuildLinkClosetModal";
import { BuildAddTaskModal } from "@/components/builds/BuildAddTaskModal";
import { BuildInviteCollaboratorModal } from "@/components/builds/BuildInviteCollaboratorModal";

const STATUSES: BuildStatus[] = ["idea", "wip", "ready", "archived"];

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export default function BuildDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as Id<"builds"> | null;
  const { userId } = useCurrentUser();

  const build = useQuery(api.builds.get, id ? { id } : "skip");
  const summary = useQuery(api.builds.getSummary, id && userId ? { buildId: id, userId } : "skip");
  const closetItemIds = useQuery(api.builds.getItems, id ? { buildId: id } : "skip") ?? [];
  const closetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip") ?? [];
  const tasks = useQuery(api.buildTasks.listByBuild, id ? { buildId: id } : "skip") ?? [];

  const updateTask = useMutation(api.buildTasks.update);
  const updateBuild = useMutation(api.builds.update);
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
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [notesSavePending, setNotesSavePending] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [editVisibility, setEditVisibility] = useState<"private" | "unlisted" | "public">(
    "private"
  );
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [fabModal, setFabModal] = useState<BuildDetailFabModal | null>(null);

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

  const linkedItems = closetItems.filter((c) => closetItemIds.includes(c._id));
  const totalCostCents = linkedItems.reduce((sum, i) => sum + (i.costCents ?? 0), 0);

  const closetRowsForLink = useMemo(
    () =>
      closetItems.map((c) => ({
        _id: c._id,
        name: c.name,
        category: c.category ?? "",
        tags: c.tags ?? [],
        _creationTime: c._creationTime,
      })),
    [closetItems]
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

  const handleCopyShareLink = async () => {
    if (!build?.shareToken) return;
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/b/s/${build.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    } catch {
      setShareLinkCopied(false);
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
      const taskId = active.id as Id<"buildTasks">;
      const closetItemId = over.id as Id<"closetItems">;
      updateTask({ id: taskId, userId, closetItemId });
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

  const tasksChecked = tasks.filter((t) => t.checked).length;
  const tasksTotal = tasks.length;
  const completionPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

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
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md pt-12 pb-4 flex items-center gap-4 lg:left-64 px-4 sm:px-6">
          <Link href="/builds" aria-label="Back to builds">
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 text-[11px] uppercase tracking-widest text-kyar-textTertiary truncate">
            {build.name}
          </span>
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSummaryModalOpen(true)}
                className="hover:text-kyar-accent p-1 text-kyar-textTertiary transition-colors"
                aria-label="Open build summary"
              >
                <span className="material-symbols-outlined font-light text-[22px]">summarize</span>
              </button>
              <button
                type="button"
                onClick={() => setNotesModalOpen(true)}
                className="hover:text-kyar-accent p-1 text-kyar-textTertiary transition-colors"
                aria-label="Open build notes"
              >
                <span className="material-symbols-outlined font-light text-[22px]">
                  description
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="hover:text-kyar-accent p-1 text-kyar-textTertiary transition-colors"
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

        <main className="mt-24 mb-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
          {isEditing ? (
            <div className="max-w-3xl mx-auto space-y-12">
              <div className="text-center pb-8 border-b border-kyar-borderSubtle">
                <h1 className="font-serif text-4xl mb-2 text-kyar-text tracking-tight">
                  Edit Project
                </h1>
                <p className="text-sm text-kyar-textTertiary uppercase tracking-widest">
                  Settings &amp; Metadata
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10 lg:gap-16">
                <div className="space-y-4">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
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
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border-0 border-b border-kyar-text/30 bg-transparent py-3 text-3xl font-serif tracking-tight focus:outline-none focus:border-kyar-text focus-visible:ring-0 placeholder:text-kyar-textTertiary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                      Character (optional)
                    </label>
                    <input
                      type="text"
                      value={editCharacter}
                      onChange={(e) => setEditCharacter(e.target.value)}
                      placeholder="e.g. Arlecchino"
                      className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-text focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-3">
                      Status
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditStatus(s)}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-colors ${
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                        Budget $ (optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editBudgetCents}
                        onChange={(e) => setEditBudgetCents(e.target.value)}
                        placeholder="0.00"
                        className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-text focus-visible:ring-0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                        Deadline (optional)
                      </label>
                      <input
                        type="date"
                        value={editTargetDate}
                        onChange={(e) => setEditTargetDate(e.target.value)}
                        className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-base focus:outline-none focus:border-kyar-text focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-3">
                      Visibility
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(["private", "unlisted", "public"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEditVisibility(v)}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest border transition-colors ${
                            editVisibility === v
                              ? "border-kyar-text bg-kyar-text text-white"
                              : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text hover:text-kyar-text"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-kyar-textTertiary mt-3 leading-relaxed">
                      Private: only you. Unlisted: anyone with link. Public: on your profile.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-kyar-borderSubtle">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={savePending || !editName.trim()}
                      className="flex-1 bg-kyar-text text-white py-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savePending ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={savePending}
                      className="px-8 py-4 border border-kyar-borderSubtle text-xs font-semibold uppercase tracking-widest hover:border-kyar-text transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row gap-10 xl:gap-14">
              {/* Left Column: Progress & Meta */}
              <aside className="flex flex-row xl:flex-col gap-8 xl:gap-10 shrink-0 border-b border-kyar-borderSubtle xl:border-0 pb-8 xl:pb-0 overflow-x-auto xl:overflow-visible xl:w-[200px]">
                <div className="flex items-center xl:items-start gap-6 xl:flex-col xl:gap-10 w-full">
                  <div className="hidden xl:block w-full">
                    <EditorialHorizontalProgressRail progress={completionPercent} />
                  </div>
                  <div className="flex flex-col items-center gap-3 w-full">
                    <EditorialProgressDonut progress={completionPercent} showFlankLabels={true} />
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary text-center">
                      Completion
                    </p>
                  </div>
                </div>

                {/* Budget Summary */}
                {build.budgetCents != null && (
                  <div className="flex flex-col items-center xl:items-start min-w-[120px]">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2 text-center xl:text-left w-full">
                      Budget Summary
                    </span>
                    <p className="text-sm font-medium text-kyar-text">
                      {formatCents(totalCostCents)} / {formatCents(build.budgetCents)}
                    </p>
                    <div className="h-[2px] bg-kyar-borderSubtle w-full mt-2 mb-1">
                      <div
                        className="h-full bg-kyar-text transition-all"
                        style={{
                          width: `${Math.min(100, (totalCostCents / (build.budgetCents || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    {totalCostCents > (build.budgetCents || 0) && (
                      <p className="text-[10px] text-red-600 mt-1 text-center xl:text-left w-full uppercase tracking-widest">
                        Over budget
                      </p>
                    )}
                  </div>
                )}

                {/* Collaborators */}
                {userId && build.userId === userId && (
                  <div id="build-collaborators" className="min-w-[180px] scroll-mt-24">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-3 text-center xl:text-left w-full">
                      Collaborators
                    </span>
                    {collaborators.length > 0 && (
                      <ul className="space-y-3 mb-4">
                        {collaborators.map((c) => (
                          <li
                            key={c.userId}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-kyar-muted border border-kyar-borderSubtle flex items-center justify-center text-[10px] font-serif shrink-0 text-kyar-text">
                                {(c.name ?? c.email ?? c.userId).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs text-kyar-text leading-tight">
                                  {c.name ?? c.email ?? c.userId}
                                </p>
                                <p className="text-[9px] text-kyar-textTertiary capitalize leading-tight">
                                  {c.role}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                removeCollaborator({
                                  buildId: id,
                                  ownerId: userId,
                                  userId: c.userId,
                                })
                              }
                              className="text-[10px] text-red-600/70 hover:text-red-600 hover:underline shrink-0"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => setFabModal("invite")}
                      className="w-full text-center xl:text-left text-[10px] uppercase tracking-widest font-bold text-kyar-text border border-kyar-borderSubtle py-2 rounded-sm hover:border-kyar-text transition-colors"
                    >
                      Invite collaborator
                    </button>
                  </div>
                )}

                {/* Sharing */}
                <div className="min-w-[120px]">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2 text-center xl:text-left w-full">
                    Visibility
                  </span>
                  <p className="text-xs text-kyar-textSecondary mb-2 text-center xl:text-left w-full capitalize">
                    {build.visibility}
                  </p>
                  {build.visibility === "unlisted" && build.shareToken && (
                    <div className="text-center xl:text-left w-full">
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="text-[10px] uppercase tracking-widest font-medium text-kyar-text hover:underline border border-kyar-borderSubtle px-3 py-1.5 rounded-sm"
                      >
                        {shareLinkCopied ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                  )}
                </div>
              </aside>

              {/* Center Column: Hero & Tasks */}
              <div className="flex-1 min-w-0 space-y-12">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-kyar-textTertiary mb-4">
                    <span>Kyarafit</span>
                    {build.character && (
                      <>
                        <span className="opacity-40">/</span>
                        <span>{build.character}</span>
                      </>
                    )}
                  </div>

                  <div className="relative mb-6 rounded-md overflow-hidden shadow-sm">
                    {build.imageStorageId ? (
                      <div className="w-full aspect-[16/9] sm:aspect-[21/9] bg-kyar-mutedWarm relative">
                        <ResolvedImage
                          imageStorageId={build.imageStorageId}
                          alt={build.name}
                          className="w-full h-full object-cover"
                          style={{
                            objectPosition:
                              build.imageFocalX != null && build.imageFocalY != null
                                ? `${build.imageFocalX * 100}% ${build.imageFocalY * 100}%`
                                : "center",
                          }}
                        />
                      </div>
                    ) : build.imageUrl ? (
                      <div className="w-full aspect-[16/9] sm:aspect-[21/9] bg-kyar-mutedWarm relative">
                        <img
                          src={build.imageUrl}
                          alt={build.name}
                          className="w-full h-full object-cover"
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
                      className={`${build.imageStorageId || build.imageUrl ? "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/50 to-transparent pt-32 pb-6 px-6 sm:px-10 flex flex-col justify-end items-center sm:items-start" : ""}`}
                    >
                      <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-kyar-text leading-[0.9] text-center sm:text-left">
                        {build.name}
                      </h1>
                    </div>
                  </div>

                  {build.targetDate && daysRemaining !== null && (
                    <div className="flex items-center gap-3 mt-4 text-sm">
                      <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary font-medium">
                        Deadline
                      </span>
                      <span className="w-px h-3 bg-kyar-borderSubtle"></span>
                      <span className="text-kyar-text font-medium">
                        {new Date(build.targetDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span
                        className={`text-xs ml-1 ${daysRemaining < 0 ? "text-red-600" : daysRemaining <= 7 ? "text-orange-600" : "text-kyar-textTertiary"}`}
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

                {/* Notes */}
                {build.notes && (
                  <section className="pl-5 border-l-2 border-kyar-text/20">
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-3">
                      Notes
                    </p>
                    <p className="text-sm text-kyar-textSecondary whitespace-pre-wrap leading-relaxed">
                      {build.notes}
                    </p>
                  </section>
                )}

                {/* Tasks */}
                <section id="build-tasks" className="pt-4 border-t border-kyar-borderSubtle">
                  <h2 className="font-serif text-2xl text-kyar-text mb-6">Tasks &amp; Timeline</h2>
                  <TaskChecklist
                    buildId={id}
                    tasks={tasks}
                    linkedItems={linkedItems}
                    enableDragDrop
                    hideInlineAdd
                  />
                </section>
              </div>

              {/* Right Column: Visual Board */}
              <div className="xl:w-[400px] shrink-0 xl:border-l xl:border-kyar-borderSubtle xl:pl-10 mt-10 xl:mt-0">
                <BuildVisualBoard
                  buildId={id}
                  userId={userId}
                  linkedItems={linkedItems}
                  onOpenLinkCloset={() => {
                    if (userId) setFabModal("linkCloset");
                  }}
                  renderClosetCard={(item) => (
                    <DroppableClosetItem item={item} justDroppedRef={justDroppedRef}>
                      <ClosetCarouselCardContent item={item} formatCents={formatCents} />
                    </DroppableClosetItem>
                  )}
                />
              </div>
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
        <BuildSummaryModal
          open={summaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          summary={summary ?? null}
          formatCents={formatCents}
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
            open={fabModal === "linkCloset"}
            onClose={() => setFabModal(null)}
            buildId={id}
            userId={userId}
            closetItems={closetRowsForLink}
            linkedIds={closetItemIds}
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

function DroppableClosetItem({
  item,
  justDroppedRef,
  children,
}: {
  item: { _id: Id<"closetItems">; name: string; status?: string };
  justDroppedRef: React.MutableRefObject<boolean>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: item._id,
    data: { type: "closetItem" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${isOver ? "ring-2 ring-kyar-accent shadow-lg scale-105" : ""}`}
    >
      <Link
        href={`/closet/${item._id}`}
        className="block cursor-pointer hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 rounded-sm"
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
