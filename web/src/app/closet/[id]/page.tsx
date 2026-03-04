"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { BottomNav } from "@/components/layout/BottomNav";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CLOSET_CATEGORIES, type ClosetCategory } from "@kyarafit/design-system/types";

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
  const updateItem = useMutation(api.closetItems.update);
  const removeItem = useMutation(api.closetItems.remove);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<ClosetCategory>("other");
  const [editTagsStr, setEditTagsStr] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCostDollars, setEditCostDollars] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageStorageId, setEditImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (item && isEditing) {
      setEditName(item.name);
      setEditCategory((item.category as ClosetCategory) ?? "other");
      setEditTagsStr((item.tags ?? []).join(", "));
      setEditNotes(item.notes ?? "");
      setEditCostDollars(item.costCents != null ? (item.costCents / 100).toFixed(2) : "");
      setEditImageUrl(item.imageUrl ?? "");
      setEditImageStorageId(item.imageStorageId ?? null);
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

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Missing item id.</p>
        <Link href="/closet" className="mt-4 text-sm underline">
          Back to Closet
        </Link>
      </div>
    );
  }

  if (item === undefined) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Item not found.</p>
        <Link href="/closet" className="mt-4 text-sm underline">
          Back to Closet
        </Link>
      </div>
    );
  }

  const isOwner = userId && item.userId === userId;

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle">
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

      <main className="flex-1 px-6 py-8">
        {isEditing ? (
          <div className="flex flex-col gap-6 max-w-md">
            <div>
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
          </div>
        ) : (
          <div className="flex flex-col gap-8 max-w-md">
            <div className="aspect-square w-full max-w-sm mx-auto bg-kyar-muted overflow-hidden">
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
              {(item.tags?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">Tags</p>
                  <p className="text-sm">{item.tags!.join(", ")}</p>
                </div>
              )}
              {item.costCents != null && item.costCents > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">Cost</p>
                  <p className="text-sm font-medium">{formatCents(item.costCents)}</p>
                </div>
              )}
              {item.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
            </div>

            {buildsUsing.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-kyar-meta mb-2">
                  Used in builds
                </p>
                <ul className="space-y-2">
                  {buildsUsing.map((b) => (
                    <li key={b._id}>
                      <Link
                        href={`/build-detail?id=${b._id}`}
                        className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
                      >
                        {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
        )}
      </main>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
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
        </div>
      )}

      <BottomNav active="builds" />
    </div>
  );
}
