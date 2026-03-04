"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { BottomNav } from "@/components/layout/BottomNav";
import { TaskChecklist } from "@/components/builds/TaskChecklist";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as Id<"builds"> | null;
  const { userId } = useCurrentUser();

  const build = useQuery(api.builds.get, id ? { id } : "skip");
  const closetItemIds = useQuery(api.builds.getItems, id ? { buildId: id } : "skip") ?? [];
  const closetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip") ?? [];
  const tasks = useQuery(api.buildTasks.listByBuild, id ? { buildId: id } : "skip") ?? [];

  const updateTask = useMutation(api.buildTasks.update);
  const updateBuild = useMutation(api.builds.update);
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

  useEffect(() => {
    if (build && isEditing) {
      setEditName(build.name);
      setEditCharacter(build.character ?? "");
      setEditStatus((build.status as BuildStatus) ?? "wip");
      setEditBudgetCents(build.budgetCents != null ? (build.budgetCents / 100).toFixed(2) : "");
      setEditTargetDate(build.targetDate ?? "");
      setEditImageUrl(build.imageUrl ?? "");
      setEditImageStorageId(build.imageStorageId ?? null);
    }
  }, [build, isEditing]);

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
      });
      setIsEditing(false);
    } finally {
      setSavePending(false);
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
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </div>
    );
  }

  if (build === undefined) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Loading...</p>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Build not found.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </div>
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
      <div className="min-h-screen flex flex-col pb-24">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 flex items-center gap-4">
          <button type="button" onClick={() => router.back()}>
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </button>
          <span className="flex-1 meta-label truncate">{build.name}</span>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="hover:opacity-70 p-1"
              aria-label="Edit build"
            >
              <span className="material-symbols-outlined font-light text-xl">edit</span>
            </button>
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

        <main className="mt-20 mb-12">
          {isEditing ? (
            <div className="px-6 mb-8 space-y-6">
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
          ) : (
            <>
              {(build.imageStorageId || build.imageUrl) && (
                <div className="w-full aspect-[3/4] bg-gray-50 mb-6">
                  <ResolvedImage
                    imageStorageId={build.imageStorageId}
                    imageUrl={build.imageUrl}
                    alt={build.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="px-6 mb-8">
                <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mb-2">
                  {build.status}
                </p>
                <h1 className="font-serif text-4xl font-bold italic tracking-tight mb-2">
                  {build.name}
                </h1>
                {build.character && (
                  <p className="text-sm text-kyar-textTertiary">Character: {build.character}</p>
                )}
              </div>

              <div className="px-6 mb-8 space-y-6">
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
            </>
          )}

          <section className="px-6 mb-10">
            <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">Tasks</h2>
            <p className="text-xs text-kyar-textTertiary mb-4 italic">
              Drag tasks onto closet items or click the link button to assign them
            </p>
            <TaskChecklist buildId={id} tasks={tasks} linkedItems={linkedItems} enableDragDrop />
          </section>

          {build.budgetCents != null && (
            <section className="px-6 mb-12">
              <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">
                Budget Tracker
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium">
                      Spent: {formatCents(totalCostCents)}
                    </span>
                    <span className="text-sm font-medium">
                      Budget: {formatCents(build.budgetCents)}
                    </span>
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
                    <p className="text-xs text-red-600 mt-1">
                      Over budget by {formatCents(totalCostCents - (build.budgetCents || 0))}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="px-6 mb-12">
            <div className="flex justify-between items-center mb-6">
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
                No closet items linked. Tap &quot;Link items&quot; to add pieces from your closet.
              </p>
            )}
            {linkedItems.length > 0 && (
              <p className="text-xs text-kyar-textTertiary mb-4 italic">
                Drop tasks here to assign them to items
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {linkedItems.map((item) => (
                <DroppableClosetItem key={item._id} item={item} justDroppedRef={justDroppedRef}>
                  <div className="flex flex-col gap-2">
                    {item.imageStorageId || item.imageUrl ? (
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        <ResolvedImage
                          imageStorageId={item.imageStorageId}
                          imageUrl={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-kyar-textTertiary">
                          image
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <p className="text-xs text-kyar-textTertiary">
                        {item.category}
                        {item.costCents != null ? ` · ${formatCents(item.costCents)}` : ""}
                      </p>
                    </div>
                  </div>
                </DroppableClosetItem>
              ))}
            </div>
          </section>

          <section className="px-6 mb-12">
            <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">
              Progress Photos
            </h2>
            <div className="border border-dashed border-kyar-border p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-kyar-textTertiary mb-2">
                photo_library
              </span>
              <p className="text-sm text-kyar-textTertiary">
                Progress photos feature coming soon. Track your build with photos and dates.
              </p>
            </div>
          </section>
        </main>

        <BottomNav active="builds" />
      </div>
    </DndContext>
  );
}

function DroppableClosetItem({
  item,
  justDroppedRef,
  children,
}: {
  item: { _id: Id<"closetItems">; name: string };
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
