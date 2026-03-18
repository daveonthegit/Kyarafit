"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { BuildOutlineTree } from "@/components/builds/BuildOutlineTree";
import { TaskChecklist } from "@/components/builds/TaskChecklist";
import { BuildNotesModal } from "@/components/builds/BuildNotesModal";
import { BuildReferenceImagesSection } from "@/components/builds/BuildReferenceImagesSection";
import { BuildProcessPicturesSection } from "@/components/builds/BuildProcessPicturesSection";
import { BuildSummaryModal } from "@/components/builds/BuildSummaryModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import {
  ClosetItemsCarousel,
  ClosetCarouselCardContent,
} from "@/components/ui/closet-items-carousel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildStatus } from "@kyarafit/design-system/types";

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
  const collaborators = useQuery(api.buildCollaborators.listByBuild, id ? { buildId: id } : "skip") ?? [];
  const addCollaborator = useMutation(api.buildCollaborators.addByEmail);
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
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [notesSavePending, setNotesSavePending] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const tasksSectionRef = useRef<HTMLElement>(null);
  const itemsSectionRef = useRef<HTMLElement>(null);
  const [editVisibility, setEditVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"viewer" | "editor">("viewer");
  const [collabPending, setCollabPending] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);

  const handleOutlineSelect = (nodeId: string) => {
    if (nodeId === "tasks" || nodeId.startsWith("task-")) {
      tasksSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (nodeId === "items" || nodeId.startsWith("item-")) {
      itemsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md pt-12 pb-4 flex items-center gap-4 lg:left-64">
          <Link href="/builds" aria-label="Back to builds">
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 meta-label truncate">{build.name}</span>
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setSummaryModalOpen(true)}
                className="hover:opacity-70 p-1"
                aria-label="Open build summary"
              >
                <span className="material-symbols-outlined font-light text-xl">summarize</span>
              </button>
              <button
                type="button"
                onClick={() => setNotesModalOpen(true)}
                className="hover:opacity-70 p-1"
                aria-label="Open build notes"
              >
                <span className="material-symbols-outlined font-light text-xl">description</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="hover:opacity-70 p-1"
                aria-label="Edit build"
              >
                <span className="material-symbols-outlined font-light text-xl">edit</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-[10px] font-semibold uppercase tracking-widest text-kyar-textTertiary hover:text-black"
            >
              Cancel
            </button>
          )}
        </header>

        <main className="mt-20 mb-12 px-4 sm:px-6">
          {isEditing ? (
            <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-8 lg:gap-12 mb-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                    Image
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
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border-0 border-b border-black bg-transparent py-2 text-lg font-serif italic font-bold focus:outline-none focus:border-kyar-accent"
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
                    className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                    Status
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStatus(s)}
                        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                          editStatus === s
                            ? "border-black bg-kyar-muted text-black"
                            : "border-kyar-border text-kyar-textTertiary hover:border-black"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
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
                    className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:border-black"
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
                    className="w-full border-0 border-b border-kyar-border bg-transparent py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
                    Visibility
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(["private", "unlisted", "public"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEditVisibility(v)}
                        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                          editVisibility === v
                            ? "border-black bg-kyar-muted text-black"
                            : "border-kyar-border text-kyar-textTertiary hover:border-black"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-kyar-textTertiary mt-1">
                    Private: only you. Unlisted: anyone with link. Public: on your profile.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={savePending || !editName.trim()}
                    className="flex-1 bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {savePending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={savePending}
                    className="px-6 py-3 border border-kyar-border text-sm font-semibold uppercase tracking-wider hover:border-black disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-8 lg:gap-12">
              {/* Left: image + key meta (sticky on desktop) */}
              <div className="lg:sticky lg:top-24 space-y-6">
                {(build.imageStorageId || build.imageUrl) && (
                  <div className="w-full aspect-[3/4] bg-gray-50 overflow-hidden rounded-sm">
                    <ResolvedImage
                      imageStorageId={build.imageStorageId}
                      imageUrl={build.imageUrl}
                      alt={build.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mb-2">
                    {build.status}
                  </p>
                  <h1 className="font-serif text-3xl lg:text-4xl font-bold italic tracking-tight mb-2">
                    {build.name}
                  </h1>
                  {build.character && (
                    <p className="text-sm text-kyar-textTertiary">Character: {build.character}</p>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
                        Completion
                      </span>
                      <span className="text-xl font-bold">{completionPercent}%</span>
                    </div>
                    <div className="h-[2px] bg-gray-200 w-full">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-kyar-textTertiary mt-1">
                      {tasksChecked} of {tasksTotal} tasks complete
                    </p>
                  </div>
                  {build.targetDate && daysRemaining !== null && (
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
                        Deadline
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">event</span>
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(build.targetDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                          <p
                            className={`text-xs ${
                              daysRemaining < 0
                                ? "text-red-600"
                                : daysRemaining <= 7
                                  ? "text-orange-600"
                                  : "text-kyar-textTertiary"
                            }`}
                          >
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)} days overdue`
                              : daysRemaining === 0
                                ? "Due today!"
                                : `${daysRemaining} days remaining`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {build.budgetCents != null && (
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
                      Budget
                    </span>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end text-sm">
                        <span>Spent: {formatCents(totalCostCents)}</span>
                        <span>Budget: {formatCents(build.budgetCents)}</span>
                      </div>
                      <div className="h-[2px] bg-gray-200 w-full">
                        <div
                          className="h-full bg-black transition-all"
                          style={{
                            width: `${Math.min(100, (totalCostCents / (build.budgetCents || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      {totalCostCents > (build.budgetCents || 0) && (
                        <p className="text-xs text-red-600">
                          Over budget by {formatCents(totalCostCents - (build.budgetCents || 0))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-kyar-borderSubtle">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
                    Sharing
                  </span>
                  <p className="text-sm text-kyar-textSecondary mb-2">
                    {build.visibility === "public"
                      ? "Public — visible on your profile"
                      : build.visibility === "unlisted"
                        ? "Unlisted — only people with the link"
                        : "Private — only you"}
                  </p>
                  {(build.visibility === "unlisted" && build.shareToken) && (
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
                    >
                      {shareLinkCopied ? "Copied!" : "Copy share link"}
                    </button>
                  )}
                </div>
                {userId && build.userId === userId && (
                  <div className="pt-2 border-t border-kyar-borderSubtle">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
                      Collaborators
                    </span>
                    {collaborators.length > 0 && (
                      <ul className="space-y-1 mb-3">
                        {collaborators.map((c) => (
                          <li key={c.userId} className="flex items-center justify-between text-sm">
                            <span>{c.name ?? c.email ?? c.userId}</span>
                            <span className="text-[11px] text-kyar-textTertiary capitalize">{c.role}</span>
                            <button
                              type="button"
                              onClick={() => removeCollaborator({ buildId: id, ownerId: userId, userId: c.userId })}
                              className="text-[11px] text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      <input
                        type="email"
                        value={collabEmail}
                        onChange={(e) => { setCollabEmail(e.target.value); setCollabError(null); }}
                        placeholder="Email to share with"
                        className="flex-1 min-w-[140px] border border-kyar-cardBorder rounded px-2 py-1.5 text-sm"
                        disabled={collabPending}
                      />
                      <select
                        value={collabRole}
                        onChange={(e) => setCollabRole(e.target.value as "viewer" | "editor")}
                        className="border border-kyar-cardBorder rounded px-2 py-1.5 text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!id || !userId || !collabEmail.trim() || collabPending) return;
                          setCollabPending(true); setCollabError(null);
                          try {
                            await addCollaborator({ buildId: id, ownerId: userId, email: collabEmail.trim(), role: collabRole });
                            setCollabEmail("");
                          } catch (e) {
                            setCollabError(e instanceof Error ? e.message : "Failed");
                          } finally {
                            setCollabPending(false);
                          }
                        }}
                        disabled={collabPending || !collabEmail.trim()}
                        className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    {collabError && <p className="text-xs text-red-600 mt-1">{collabError}</p>}
                  </div>
                )}
                <div className="border border-kyar-borderSubtle rounded-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowOutline((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium text-kyar-textTertiary hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset"
                    aria-expanded={showOutline}
                  >
                    <span>Outline</span>
                    <span
                      className={`material-symbols-outlined text-lg transition-transform ${showOutline ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                  </button>
                  {showOutline && (
                    <div className="border-t border-kyar-borderSubtle p-2 max-h-[280px] overflow-y-auto">
                      <BuildOutlineTree
                        buildName={build.name}
                        tasks={tasks}
                        linkedItems={linkedItems}
                        onSelect={handleOutlineSelect}
                      />
                    </div>
                  )}
                </div>
                {userId && <BuildReferenceImagesSection buildId={id} userId={userId} />}
                {userId && <BuildProcessPicturesSection buildId={id} userId={userId} />}
              </div>

              {/* Right: tasks, link items, progress */}
              <div className="space-y-10 min-w-0">
                <section ref={tasksSectionRef} id="build-tasks">
                  <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">
                    Tasks
                  </h2>
                  <p className="text-xs text-kyar-textTertiary mb-4 italic">
                    Drag tasks onto closet items or click the link button to assign them
                  </p>
                  <TaskChecklist
                    buildId={id}
                    tasks={tasks}
                    linkedItems={linkedItems}
                    enableDragDrop
                  />
                </section>

                <section ref={itemsSectionRef} id="build-items">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                    <h2 className="font-serif text-xl italic border-b border-black pb-2">
                      Associated Closet Items ({linkedItems.length})
                    </h2>
                    <Link
                      href={`/build-detail/link-items?id=${id}`}
                      className="text-[10px] font-semibold uppercase tracking-widest border border-black px-3 py-2 hover:bg-kyar-muted"
                    >
                      Link items
                    </Link>
                  </div>
                  {linkedItems.length === 0 && (
                    <p className="text-sm text-kyar-meta">
                      No closet items linked. Tap &quot;Link items&quot; to add pieces from your
                      closet.
                    </p>
                  )}
                  {linkedItems.length > 0 && (
                    <>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium">
                          <span>Closet items completion</span>
                          <span>
                            {linkedItems.filter((i) => i.status === "complete").length} of{" "}
                            {linkedItems.length} complete
                          </span>
                        </div>
                        <div className="h-px bg-gray-200 w-full">
                          <div
                            className="h-full bg-black transition-all duration-300"
                            style={{
                              width: `${linkedItems.length > 0 ? Math.round((linkedItems.filter((i) => i.status === "complete").length / linkedItems.length) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div aria-label={`Associated closet items, ${linkedItems.length} items`}>
                        <ClosetItemsCarousel
                          items={linkedItems}
                          keyExtractor={(item) => item._id}
                          renderItem={(item) => (
                            <DroppableClosetItem item={item} justDroppedRef={justDroppedRef}>
                              <ClosetCarouselCardContent item={item} formatCents={formatCents} />
                            </DroppableClosetItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </section>
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
