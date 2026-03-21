"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { Sheet } from "@/components/ui/sheet";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type NewClosetItemModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewClosetItemModal({ onDismiss, onSuccessComplete }: NewClosetItemModalProps) {
  const router = useRouter();
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
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId) return;

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
      setError(parsed.error.errors[0]?.message ?? "Invalid fields");
      return;
    }

    setIsPending(true);
    try {
      await createItem({
        userId,
        name: parsed.data.name,
        category: parsed.data.category,
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: parsed.data.imageUrl,
        itemLink: parsed.data.itemLink,
        costCents: parsed.data.costCents ?? undefined,
      });
      onSuccessComplete();
      router.push("/closet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onDismiss}
      title="New item"
      titleId="global-new-closet-modal-title"
      size="lg"
      closeDisabled={isPending}
      footer={
        <button
          type="submit"
          form="new-closet-item-modal-form"
          disabled={isPending}
          className="w-full bg-black py-4 text-[10px] font-bold uppercase tracking-widest text-white rounded-full disabled:opacity-50 hover:bg-black/90 transition-colors shadow-md"
        >
          {isPending ? "Saving…" : "Save item"}
        </button>
      }
    >
      <form id="new-closet-item-modal-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
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
          label="Item name"
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
          label="Item link (optional)"
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
        {error && <p className="text-xs text-kyar-danger">{error}</p>}
      </form>
    </Sheet>
  );
}
