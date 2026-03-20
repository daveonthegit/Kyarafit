"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type LinkClosetQuickCreateModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called with new item id; item is auto-linked on next save if you add to selection in parent. */
  onCreated: (id: Id<"closetItems">) => void;
};

/**
 * Minimal “new closet item” flow for use inside link-to-build modal (stacked overlay).
 */
export function LinkClosetQuickCreateModal({
  open,
  onClose,
  onCreated,
}: LinkClosetQuickCreateModalProps) {
  const { userId } = useCurrentUser();
  const createItem = useMutation(api.closetItems.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("other");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setName("");
    setCategory("other");
    setImageStorageId(null);
    setImageUrl("");
    setError("");
  };

  const handleClose = () => {
    if (!pending) {
      reset();
      onClose();
    }
  };

  const submit = async () => {
    setError("");
    if (!userId) {
      setError("Sign in to create items.");
      return;
    }
    const parsed = createClosetItemSchema.safeParse({
      name: name.trim(),
      category,
      tags: [],
      notes: undefined,
      imageUrl: imageUrl.trim() || undefined,
      itemLink: undefined,
      costCents: undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Check the name and category.");
      return;
    }

    setPending(true);
    try {
      const doc = await createItem({
        userId,
        name: parsed.data.name,
        category: parsed.data.category,
        tags: [],
        notes: undefined,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: parsed.data.imageUrl,
        itemLink: undefined,
        costCents: undefined,
      });
      if (doc?._id) {
        onCreated(doc._id);
        reset();
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create item");
    } finally {
      setPending(false);
    }
  };

  return (
    <BuildDetailModalShell
      open={open}
      onClose={handleClose}
      title="New closet item"
      titleId="link-closet-quick-create-title"
      size="lg"
      closeDisabled={pending}
      zOverlayClass="z-[10200]"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="flex-1 min-w-[100px] px-4 py-2.5 border border-kyar-border text-xs font-semibold uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim()}
            className="flex-1 min-w-[100px] bg-kyar-text text-white py-2.5 text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create & select"}
          </button>
        </>
      }
    >
      <p className="text-sm text-kyar-textSecondary mb-4">
        Creates a new item and selects it for this build. Save links on the previous screen when
        you’re done.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-2">
            Photo (optional)
          </label>
          <ImageUpload
            category="closet"
            onImageSelected={(result) => {
              if ("imageStorageId" in result && result.imageStorageId) {
                setImageStorageId(result.imageStorageId);
                setImageUrl("");
              } else {
                setImageUrl(result.imageUrl ?? "");
                setImageStorageId(null);
              }
            }}
            currentImage={imageUrl || undefined}
            currentStorageId={imageStorageId ?? undefined}
          />
        </div>
        <div>
          <label
            htmlFor="quick-closet-name"
            className="block text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-2"
          >
            Name
          </label>
          <input
            id="quick-closet-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red boots"
            className="w-full border border-kyar-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/30 focus:border-kyar-accent"
          />
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-2">
            Category
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
            {CLOSET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wide rounded-md border ${
                  category === c
                    ? "border-kyar-text bg-kyar-text text-white"
                    : "border-kyar-border text-kyar-textSecondary hover:border-kyar-text"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </BuildDetailModalShell>
  );
}
