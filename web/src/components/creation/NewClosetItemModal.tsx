"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  type CosplayCategory,
  type CosplayNodeType,
} from "@kyarafit/design-system/types";
import { Sheet } from "@/components/ui/sheet";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { NewNodeModalOptions } from "@/contexts/CreationModalsContext";

type NewClosetItemModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
  options?: NewNodeModalOptions;
};

export function NewClosetItemModal({
  onDismiss,
  onSuccessComplete,
  options,
}: NewClosetItemModalProps) {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createNode = useMutation(api.cosplayNodes.create);
  const [nodeType, setNodeType] = useState<CosplayNodeType>(options?.initialNodeType ?? "element");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CosplayCategory>(
    (options?.initialCategory as CosplayCategory | undefined) ??
      (options?.initialNodeType === "material" ? "material" : "other")
  );
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [directCostDollars, setDirectCostDollars] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId || !name.trim()) return;

    setIsPending(true);
    try {
      const created = await createNode({
        userId,
        nodeType,
        name: name.trim(),
        category,
        tags: tagsStr
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: imageUrl.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        directCostCents: directCostDollars.trim()
          ? Math.round(parseFloat(directCostDollars) * 100)
          : undefined,
        quantity: nodeType === "material" && quantity.trim() ? Number(quantity) : undefined,
        unit: nodeType === "material" ? unit.trim() || undefined : undefined,
        purchaseStatus: nodeType === "element" ? "to_buy" : undefined,
        buildStatus: nodeType === "element" ? "not_started" : undefined,
        materialStatus: nodeType === "material" ? "to_buy" : undefined,
      });
      if (created?._id && options?.onCreated) {
        await options.onCreated({
          _id: created._id,
          nodeType,
          name: name.trim(),
        });
      }
      onSuccessComplete();
      if (options?.successRedirectTo !== null) {
        router.push(options?.successRedirectTo ?? "/elements");
      }
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
      title={`New ${nodeType === "material" ? "material" : "cosplay element"}`}
      titleId="global-new-closet-modal-title"
      size="lg"
      closeDisabled={isPending}
      footer={
        <button
          type="submit"
          form="new-closet-item-modal-form"
          disabled={isPending}
          className="w-full rounded-full bg-black py-4 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : `Save ${nodeType}`}
        </button>
      }
    >
      <form id="new-closet-item-modal-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-kyar-meta">
            Node type
          </label>
          <div className="flex gap-2">
            {COSPLAY_NODE_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setNodeType(value);
                  if (!options?.initialCategory) {
                    setCategory(value === "material" ? "material" : "other");
                  }
                }}
                className={`rounded-sm border border-black px-3 py-2 text-xs uppercase tracking-wide ${
                  nodeType === value ? "bg-black text-white" : "bg-transparent text-black"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
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
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-kyar-meta">
            Category
          </label>
          <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto">
            {COSPLAY_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-sm border border-black px-3 py-2 text-xs uppercase tracking-wide ${
                  category === value ? "bg-black text-white" : "bg-transparent text-black"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <UnderlineInput
          label="Tags (comma-separated)"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />
        <UnderlineInput
          label="Direct cost $ (optional)"
          type="number"
          min="0"
          step="0.01"
          value={directCostDollars}
          onChange={(e) => setDirectCostDollars(e.target.value)}
        />
        {nodeType === "material" && (
          <div className="grid grid-cols-2 gap-4">
            <UnderlineInput
              label="Quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <UnderlineInput label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        )}
        <UnderlineInput
          label="Source link (optional)"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        <UnderlineInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="text-xs text-kyar-danger">{error}</p>}
      </form>
    </Sheet>
  );
}
