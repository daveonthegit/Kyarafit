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
      <header className="sticky top-0 z-40 bg-kyar-bgWarm/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
        <div className="flex items-center justify-between">
          <Link
            href="/closet"
            className="flex items-center gap-2 text-kyar-text"
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
                className="text-[10px] uppercase tracking-widest font-semibold"
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
                  className="text-[10px] uppercase tracking-widest opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savePending}
                  className="text-[10px] uppercase tracking-widest font-semibold disabled:opacity-50"
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-8 lg:gap-12 max-w-4xl">
            <div className="lg:sticky lg:top-24">
              <div className="aspect-square w-full max-w-sm lg:max-w-none mx-auto bg-kyar-muted overflow-hidden rounded-sm">
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
              </div>
            </div>
            <div className="space-y-6 min-w-0">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">Name</p>
                  <p className="font-serif text-xl font-bold italic">{item.name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">
                    Category
                  </p>
                  <p className="text-sm capitalize">{item.category}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">
                    Status
                  </p>
                  <p className="text-sm capitalize">
                    {(item.status as ClosetItemStatus) &&
                    CLOSET_ITEM_STATUSES.includes(item.status as ClosetItemStatus)
                      ? item.status === "in_progress"
                        ? "In progress"
                        : item.status
                      : "Planned"}
                  </p>
                </div>
                {(item.tags?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">
                      Tags
                    </p>
                    <p className="text-sm">{item.tags!.join(", ")}</p>
                  </div>
                )}
                {item.costCents != null && item.costCents > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">
                      Cost
                    </p>
                    <p className="text-sm font-medium">{formatCents(item.costCents)}</p>
                  </div>
                )}
                {item.notes && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">
                      Notes
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-2">Builds</p>
                {buildsUsing.length > 0 && (
                  <ul className="space-y-2 mb-2">
                    {buildsUsing.map((b) => (
                      <li key={b._id} className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/build-detail?id=${b._id}`}
                          className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
                        >
                          {b.name}
                        </Link>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFromBuild(b._id)}
                            disabled={addToBuildPending}
                            className="text-xs text-kyar-textTertiary hover:text-red-600 underline disabled:opacity-50"
                          >
                            Remove from build
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
                    className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
                  >
                    Add to build
                  </button>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-2">Tasks</p>
                <p className="text-xs text-kyar-textTertiary mb-3">
                  Add tasks here or assign from builds. Mark one as this item’s completion task to
                  sync status when it’s checked.
                </p>
                {isOwner && (
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newTaskLabel}
                      onChange={(e) => setNewTaskLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      placeholder="Add a task..."
                      className="flex-1 border-0 border-b border-black bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAddTask}
                      disabled={!newTaskLabel.trim() || taskActionPending}
                      className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      {taskActionPending ? "Adding..." : "Add"}
                    </button>
                  </div>
                )}
                {tasksAssigned.length === 0 ? (
                  <p className="text-sm text-kyar-textTertiary">No tasks yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {tasksAssigned.map((t) => (
                      <li
                        key={t._id}
                        className="flex items-center gap-3 py-2 px-3 border border-kyar-border hover:border-black transition group"
                      >
                        <input
                          type="checkbox"
                          checked={t.checked}
                          onChange={(e) => handleToggleTask(t._id, e.target.checked)}
                          className="w-4 h-4 accent-black"
                          disabled={!isOwner}
                        />
                        <div className="flex-1 min-w-0">
                          {t.buildId ? (
                            <Link
                              href={`/build-detail?id=${t.buildId}`}
                              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
                            >
                              <span
                                className={t.checked ? "line-through text-kyar-textTertiary" : ""}
                              >
                                {t.label}
                              </span>
                              {t.buildName && (
                                <span className="text-kyar-textTertiary font-normal">
                                  {" "}
                                  · {t.buildName}
                                </span>
                              )}
                            </Link>
                          ) : (
                            <span
                              className={`text-sm ${t.checked ? "line-through text-kyar-textTertiary" : ""}`}
                            >
                              {t.label}
                            </span>
                          )}
                        </div>
                        {isOwner && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            {item.completionTaskId === t._id ? (
                              <button
                                type="button"
                                onClick={() => updateItem({ id, userId, completionTaskId: null })}
                                className="text-xs text-kyar-textTertiary hover:text-black"
                                title="Clear completion task"
                              >
                                Clear completion
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateItem({ id, userId, completionTaskId: t._id })}
                                className="text-xs text-kyar-textTertiary hover:text-black"
                                title="Set as completion task"
                              >
                                Set completion
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(t._id)}
                              className="text-xs text-red-600 hover:text-red-800"
                              title="Delete task"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isOwner && (
                <div className="pt-4 border-t border-kyar-borderSubtle">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-kyar-danger font-medium"
                  >
                    Delete item
                  </button>
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
              className="flex-1 py-2 border border-black text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="flex-1 py-2 bg-kyar-danger text-white text-sm font-medium disabled:opacity-50"
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
