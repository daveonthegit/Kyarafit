"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  CLOSET_CATEGORIES,
  CLOSET_ITEM_STATUSES,
  type ClosetCategory,
  type ClosetItemStatus,
} from "@kyarafit/design-system/types";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function ClosetItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"closetItems">;
  const { userId } = useCurrentUser();

  const item = useQuery(api.closetItems.get, id ? { id } : "skip");
  const buildsUsing =
    useQuery(api.builds.getBuildsUsingClosetItem, id ? { closetItemId: id } : "skip") ?? [];
  const tasksAssigned =
    useQuery(api.buildTasks.listByClosetItem, id ? { closetItemId: id } : "skip") ?? [];
  const updateItem = useMutation(api.closetItems.update);
  const removeItem = useMutation(api.closetItems.remove);
  const createTask = useMutation(api.buildTasks.create);
  const updateTask = useMutation(api.buildTasks.update);
  const deleteTask = useMutation(api.buildTasks.remove);
  const addItemsToBuild = useMutation(api.builds.addItemsToBuild);
  const removeItemFromBuild = useMutation(api.builds.removeItemFromBuild);
  const allBuilds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<ClosetCategory>("other");
  const [editTagsStr, setEditTagsStr] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCostDollars, setEditCostDollars] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageStorageId, setEditImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [editItemLink, setEditItemLink] = useState("");
  const [editStatus, setEditStatus] = useState<ClosetItemStatus>("planned");
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [taskActionPending, setTaskActionPending] = useState(false);
  const [showAddToBuildPanel, setShowAddToBuildPanel] = useState(false);
  const [addToBuildPending, setAddToBuildPending] = useState(false);

  useEffect(() => {
    if (item && isEditing) {
      setEditName(item.name);
      setEditCategory((item.category as ClosetCategory) ?? "other");
      setEditTagsStr((item.tags ?? []).join(", "));
      setEditNotes(item.notes ?? "");
      setEditCostDollars(item.costCents != null ? (item.costCents / 100).toFixed(2) : "");
      setEditImageUrl(item.imageUrl ?? "");
      setEditImageStorageId(item.imageStorageId ?? null);
      setEditItemLink((item as { itemLink?: string | null }).itemLink ?? "");
      setEditStatus(
        (item.status as ClosetItemStatus) &&
          CLOSET_ITEM_STATUSES.includes(item.status as ClosetItemStatus)
          ? (item.status as ClosetItemStatus)
          : "planned"
      );
    }
  }, [item, isEditing]);

  const handleSave = async () => {
    if (!id || !userId) return;
    setSavePending(true);
    try {
      const tags = editTagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateItem({
        id,
        userId,
        name: editName.trim(),
        category: editCategory,
        tags,
        notes: editNotes.trim() || undefined,
        costCents: editCostDollars.trim()
          ? Math.round(parseFloat(editCostDollars) * 100)
          : undefined,
        imageUrl: editImageUrl.trim() || undefined,
        imageStorageId: editImageStorageId ?? undefined,
        itemLink: editItemLink.trim() || null,
        status: editStatus,
      });
      setIsEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !userId) return;
    setDeletePending(true);
    try {
      await removeItem({ id, userId });
      router.push("/closet");
    } finally {
      setDeletePending(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskLabel.trim() || !id || !userId) return;
    setTaskActionPending(true);
    try {
      await createTask({ userId, closetItemId: id, label: newTaskLabel.trim() });
      setNewTaskLabel("");
    } finally {
      setTaskActionPending(false);
    }
  };

  const handleToggleTask = (taskId: Id<"buildTasks">, checked: boolean) => {
    if (!userId) return;
    updateTask({ id: taskId, userId, checked });
  };

  const handleDeleteTask = (taskId: Id<"buildTasks">) => {
    if (!userId) return;
    deleteTask({ id: taskId, userId });
  };

  const buildsUsingIds = new Set(buildsUsing.map((b) => b._id));
  const handleAddToBuild = async (buildId: Id<"builds">) => {
    if (!id || !userId) return;
    setAddToBuildPending(true);
    try {
      await addItemsToBuild({ userId, buildId, closetItemIds: [id] });
      setShowAddToBuildPanel(false);
    } finally {
      setAddToBuildPending(false);
    }
  };

  const handleRemoveFromBuild = async (buildId: Id<"builds">) => {
    if (!id || !userId) return;
    setAddToBuildPending(true);
    try {
      await removeItemFromBuild({ userId, buildId, closetItemId: id });
    } finally {
      setAddToBuildPending(false);
    }
  };

  if (!id) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Missing item id.</p>
        <Link href="/closet" className="mt-4 text-sm underline">
          Back to Closet
        </Link>
      </WebAppShell>
    );
  }

  if (item === undefined) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading...</p>
      </WebAppShell>
    );
  }

  if (!item) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Item not found.</p>
        <Link href="/closet" className="mt-4 text-sm underline">
          Back to Closet
        </Link>
      </WebAppShell>
    );
  }

  const isOwner = userId && item.userId === userId;

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-kyar-bg/95 backdrop-blur-sm pt-4 sm:pt-6 pb-4 border-b border-kyar-borderSubtle">
        <div className="flex items-center justify-between">
          <Link
            href="/closet"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            aria-label="Back to closet"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <h1 className="font-serif text-xl font-bold tracking-tight italic">
            {isEditing ? "Edit item" : "Item"}
          </h1>
          <div className="flex items-center gap-2">
            {isOwner && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-kyar-borderSubtle rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Edit item"
              >
                Edit
              </button>
            )}
            {isOwner && isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savePending}
                  className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-black text-white rounded-full hover:bg-black/90 transition-colors disabled:opacity-50 shadow-md"
                >
                  {savePending ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 py-8">
        {isEditing ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-8 lg:gap-12 max-w-4xl">
            <div className="lg:sticky lg:top-24">
              <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-2">
                Photo
              </label>
              <ImageUpload
                category="closet"
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
            <div className="flex flex-col gap-6 min-w-0">
              <UnderlineInput
                label="Item name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Arlecchino Wig"
                required
              />
              <div>
                <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLOSET_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditCategory(c)}
                      className={`px-3 py-2 text-xs uppercase tracking-wide border border-black rounded-sm ${
                        editCategory === c ? "bg-black text-white" : "bg-transparent text-black"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <UnderlineInput
                label="Tags (comma-separated)"
                value={editTagsStr}
                onChange={(e) => setEditTagsStr(e.target.value)}
                placeholder="wig, character, red"
              />
              <UnderlineInput
                label="Cost $"
                type="number"
                min="0"
                step="0.01"
                value={editCostDollars}
                onChange={(e) => setEditCostDollars(e.target.value)}
                placeholder="0.00"
              />
              <UnderlineInput
                label="Item link (optional)"
                type="url"
                value={editItemLink}
                onChange={(e) => setEditItemLink(e.target.value)}
                placeholder="https://… (product page, store link)"
              />
              <UnderlineInput
                label="Notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
              />
              <div>
                <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLOSET_ITEM_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`px-3 py-2 text-xs uppercase tracking-wide border rounded-sm ${
                        editStatus === s
                          ? "border-black bg-black text-white"
                          : "border-kyar-border bg-transparent text-black hover:border-black"
                      }`}
                    >
                      {s === "in_progress" ? "In progress" : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] xl:grid-cols-[minmax(0,500px)_1fr] gap-8 lg:gap-16 max-w-6xl mx-auto">
            <div className="lg:sticky lg:top-24 h-[60vh] lg:h-[calc(100vh-8rem)]">
              <div className="w-full h-full bg-kyar-muted overflow-hidden rounded-2xl shadow-soft relative">
                {item.imageStorageId || item.imageUrl ? (
                  <ResolvedImage
                    imageStorageId={item.imageStorageId}
                    imageUrl={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                    <span className="material-symbols-outlined text-6xl">checkroom</span>
                  </div>
                )}
                <div className="absolute bottom-6 left-6 bg-black text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-sm">
                  ITEM {(item._id as string).substring(0, 8)}
                </div>
              </div>
            </div>

            <div className="flex flex-col pt-4 lg:pt-8 min-w-0 pb-24">
              <div className="flex justify-between items-start gap-4 mb-8">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta leading-relaxed max-w-[60%]">
                  {item.category}
                  {item.tags && item.tags.length > 0
                    ? ` / ${item.tags.join(", ")}`
                    : " / CUSTOM FABRICATION"}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text shrink-0 text-right leading-relaxed">
                  {(item.status as ClosetItemStatus) === "in_progress"
                    ? "IN\nPROGRESS"
                    : item.status}
                </p>
              </div>

              <h1 className="font-serif text-6xl lg:text-7xl font-normal italic tracking-tight mb-16 leading-none">
                {item.name}
              </h1>

              <div className="flex flex-wrap gap-16 border-t border-b border-kyar-borderSubtle py-8 mb-16">
                {item.costCents != null && (
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-kyar-meta mb-2">
                      EST. COST
                    </p>
                    <p className="font-serif text-3xl italic text-kyar-text">
                      {formatCents(item.costCents)}
                    </p>
                  </div>
                )}
                {(item as { itemLink?: string | null }).itemLink && (
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-kyar-meta mb-2">
                      SOURCE
                    </p>
                    <a
                      href={(item as { itemLink: string }).itemLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-3xl italic text-kyar-text hover:text-kyar-accent transition-colors truncate block max-w-[200px]"
                    >
                      Link
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 mb-16">
                <div>
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                    Task List
                  </h2>
                  {tasksAssigned.length === 0 ? (
                    <p className="text-xs text-kyar-textTertiary italic mb-6">No tasks yet.</p>
                  ) : (
                    <ul className="space-y-5 mb-8">
                      {tasksAssigned.map((t) => (
                        <li key={t._id} className="flex items-start gap-4 group">
                          <input
                            type="checkbox"
                            checked={t.checked}
                            onChange={(e) => handleToggleTask(t._id, e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded-full border-2 border-kyar-borderSubtle text-black focus:ring-black focus:ring-offset-0 transition-colors cursor-pointer checked:border-black shrink-0"
                            disabled={!isOwner}
                          />
                          <div className="flex-1 min-w-0">
                            {t.buildId ? (
                              <Link
                                href={`/build-detail?id=${t.buildId}`}
                                className="block hover:opacity-70 transition-opacity"
                              >
                                <span
                                  className={`text-xs font-medium ${t.checked ? "line-through text-kyar-meta" : "text-kyar-text"}`}
                                >
                                  {t.label}
                                </span>
                              </Link>
                            ) : (
                              <span
                                className={`text-xs font-medium block ${t.checked ? "line-through text-kyar-meta" : "text-kyar-text"}`}
                              >
                                {t.label}
                              </span>
                            )}
                          </div>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(t._id)}
                              className="opacity-0 group-hover:opacity-100 text-kyar-meta hover:text-kyar-danger transition-all shrink-0"
                              aria-label="Delete task"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOwner && (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newTaskLabel}
                        onChange={(e) => setNewTaskLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                        placeholder="Add new task..."
                        className="flex-1 bg-transparent border-b border-kyar-borderSubtle py-1.5 text-xs focus:outline-none focus:border-black placeholder:text-kyar-meta transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleAddTask}
                        disabled={!newTaskLabel.trim() || taskActionPending}
                        className="text-[9px] font-bold uppercase tracking-widest text-kyar-text hover:text-kyar-accent transition-colors disabled:opacity-50 shrink-0"
                      >
                        ADD ACTION
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                    Associated Lookbooks
                  </h2>
                  {buildsUsing.length === 0 ? (
                    <p className="text-xs text-kyar-textTertiary italic mb-6">
                      No associated builds.
                    </p>
                  ) : (
                    <ul className="space-y-5 mb-8">
                      {buildsUsing.map((b) => (
                        <li key={b._id} className="flex gap-4 group">
                          <Link href={`/build-detail?id=${b._id}`} className="flex-shrink-0">
                            <div className="w-12 h-14 bg-kyar-muted rounded-xl overflow-hidden border border-kyar-borderSubtle shadow-sm">
                              {b.imageStorageId || b.imageUrl ? (
                                <ResolvedImage
                                  imageStorageId={b.imageStorageId}
                                  imageUrl={b.imageUrl}
                                  alt={b.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                                  <span className="material-symbols-outlined text-lg">palette</span>
                                </div>
                              )}
                            </div>
                          </Link>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <Link
                              href={`/build-detail?id=${b._id}`}
                              className="block group-hover:text-kyar-accent transition-colors"
                            >
                              <p className="font-serif italic font-bold text-base leading-tight truncate">
                                {b.name}
                              </p>
                              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-kyar-meta mt-1 truncate">
                                {b.character || "ARCHIVE 02"}
                              </p>
                            </Link>
                          </div>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromBuild(b._id)}
                              disabled={addToBuildPending}
                              className="text-[9px] uppercase tracking-widest text-kyar-meta hover:text-kyar-danger transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100 shrink-0 self-center"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowAddToBuildPanel(true)}
                      className="text-[9px] font-bold uppercase tracking-widest text-kyar-text hover:text-kyar-accent transition-colors block"
                    >
                      + ADD TO LOOKBOOK
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
                <div>
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                    Swatches
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {item.tags && item.tags.length > 0 ? (
                      item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 border border-kyar-borderSubtle rounded-sm text-[8px] font-bold uppercase tracking-widest text-kyar-meta bg-kyar-surface"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-kyar-textTertiary italic">No tags defined.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                    Editorial Notes
                  </h2>
                  {item.notes ? (
                    <p className="text-xs text-kyar-text leading-relaxed whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  ) : (
                    <p className="text-xs text-kyar-textTertiary italic">No notes added.</p>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="fixed bottom-0 right-0 left-0 lg:left-[auto] lg:w-[calc(100%-minmax(0,400px)-4rem)] xl:w-[calc(100%-minmax(0,500px)-4rem)] max-w-6xl mx-auto p-4 lg:p-8 flex justify-end gap-3 pointer-events-none z-30">
                  <div className="pointer-events-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-8 py-4 bg-black text-white text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-black/90 transition-colors"
                    >
                      UPDATE PROGRESS
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: item.name,
                            url: window.location.href,
                          });
                        }
                      }}
                      className="w-12 h-12 bg-white text-black flex items-center justify-center border border-kyar-borderSubtle shadow-soft hover:bg-kyar-muted transition-colors"
                      aria-label="Share"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-12 h-12 bg-white text-kyar-danger flex items-center justify-center border border-kyar-borderSubtle shadow-soft hover:bg-red-50 transition-colors"
                      aria-label="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AdaptiveModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        aria-labelledby="delete-dialog-title"
      >
        <div className="p-6">
          <h2 id="delete-dialog-title" className="font-serif text-lg font-bold mb-2">
            Delete this item?
          </h2>
          <p className="text-sm text-kyar-meta mb-6">
            This cannot be undone. The item will be removed from any builds it’s linked to.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 border border-black text-sm font-bold uppercase tracking-wider rounded-full hover:bg-black hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="flex-1 py-3 bg-kyar-danger text-white text-sm font-bold uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deletePending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </AdaptiveModal>

      <ResponsivePanel
        open={showAddToBuildPanel}
        onClose={() => setShowAddToBuildPanel(false)}
        title="Add to build"
      >
        <div className="space-y-2">
          {allBuilds.length === 0 ? (
            <p className="text-sm text-kyar-textTertiary">No builds yet. Create a build first.</p>
          ) : (
            allBuilds.map((b) => {
              const alreadyLinked = buildsUsingIds.has(b._id);
              return (
                <div
                  key={b._id}
                  className="flex items-center justify-between gap-3 p-3 border border-kyar-border hover:border-black transition"
                >
                  <Link
                    href={`/build-detail?id=${b._id}`}
                    className="text-sm font-medium flex-1 min-w-0 truncate hover:underline"
                  >
                    {b.name}
                  </Link>
                  {alreadyLinked ? (
                    <span className="text-xs text-kyar-textTertiary shrink-0">Linked</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToBuild(b._id)}
                      disabled={addToBuildPending}
                      className="text-xs font-semibold uppercase tracking-wider border border-black px-3 py-1.5 hover:bg-black hover:text-white disabled:opacity-50 shrink-0"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ResponsivePanel>
    </WebAppShell>
  );
}
