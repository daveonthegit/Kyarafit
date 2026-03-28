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
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;

type LinkClosetQuickCreateModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called with new item id; item is auto-linked on next save if you add to selection in parent. */
  onCreated: (id: ClosetEntityId) => void;
};

/**
 * New closet item flow inside link-to-build modal — same fields as the global new-item sheet.
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
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [itemLink, setItemLink] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setName("");
    setCategory("other");
    setTagsStr("");
    setNotes("");
    setCostDollars("");
    setImageStorageId(null);
    setImageUrl("");
    setItemLink("");
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
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = createClosetItemSchema.safeParse({
      name: name.trim(),
      category,
      tags,
      notes: notes.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      itemLink: itemLink.trim() || undefined,
      costCents: costDollars.trim() ? Math.round(parseFloat(costDollars) * 100) : undefined,
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
        category: parsed.data.category ?? "other",
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: parsed.data.imageUrl,
        itemLink: parsed.data.itemLink ?? undefined,
        costCents: parsed.data.costCents ?? undefined,
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
      title="New cosplay element"
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
            type="submit"
            form="link-closet-quick-create-form"
            disabled={pending}
            className="flex-1 min-w-[100px] bg-kyar-text text-white py-2.5 text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create & select"}
          </button>
        </>
      }
    >
      <p className="text-sm text-kyar-textSecondary mb-4">
        Creates a new cosplay element and selects it for this build. Save links on the previous
        screen when you’re done.
      </p>
      <form
        id="link-closet-quick-create-form"
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-kyar-meta">
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
        <UnderlineInput
          label="Element name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Arlecchino Wig"
          required
        />
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-kyar-meta">
            Category
          </label>
          <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto">
            {CLOSET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-sm border border-black px-3 py-2 text-xs uppercase tracking-wide ${
                  category === c ? "bg-black text-white" : "bg-transparent text-black"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <UnderlineInput
          label="Tags (comma-separated)"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          placeholder="wig, character, red"
        />
        <UnderlineInput
          label="Cost $ (optional)"
          type="number"
          min="0"
          step="0.01"
          value={costDollars}
          onChange={(e) => setCostDollars(e.target.value)}
          placeholder="0.00"
        />
        <UnderlineInput
          label="Source link (optional)"
          type="url"
          value={itemLink}
          onChange={(e) => setItemLink(e.target.value)}
          placeholder="https://…"
        />
        <UnderlineInput
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
        {error && (
          <p className="text-xs text-kyar-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </BuildDetailModalShell>
  );
}
