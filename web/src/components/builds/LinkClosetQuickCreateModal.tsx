"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  type CosplayCategory,
  type CosplayNodeType,
} from "@kyarafit/design-system/types";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type LinkClosetQuickCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: Id<"cosplayNodes">) => void;
};

export function LinkClosetQuickCreateModal({
  open,
  onClose,
  onCreated,
}: LinkClosetQuickCreateModalProps) {
  const { userId } = useCurrentUser();
  const createNode = useMutation(api.cosplayNodes.create);
  const [nodeType, setNodeType] = useState<CosplayNodeType>("element");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CosplayCategory>("other");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError("");
    if (!userId || !name.trim()) return;
    setPending(true);
    try {
      const doc = await createNode({
        userId,
        nodeType,
        name: name.trim(),
        category,
        tags: tagsStr.split(",").map((tag) => tag.trim()).filter(Boolean),
        notes: notes.trim() || undefined,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: imageUrl.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        directCostCents: costDollars.trim() ? Math.round(parseFloat(costDollars) * 100) : undefined,
        purchaseStatus: nodeType === "element" ? "to_buy" : undefined,
        buildStatus: nodeType === "element" ? "not_started" : undefined,
        materialStatus: nodeType === "material" ? "to_buy" : undefined,
      });
      if (doc?._id) {
        onCreated(doc._id);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create node");
    } finally {
      setPending(false);
    }
  };

  return (
    <BuildDetailModalShell
      open={open}
      onClose={onClose}
      title={`New ${nodeType}`}
      titleId="link-closet-quick-create-title"
      size="lg"
      closeDisabled={pending}
      zOverlayClass="z-[10200]"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 min-w-[100px] rounded-md border border-kyar-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="link-closet-quick-create-form"
            disabled={pending}
            className="flex-1 min-w-[100px] rounded-md bg-kyar-text py-2.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create & select"}
          </button>
        </>
      }
    >
      <form
        id="link-closet-quick-create-form"
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex gap-2">
          {COSPLAY_NODE_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setNodeType(value);
                setCategory(value === "material" ? "material" : "other");
              }}
              className={`rounded-sm border border-black px-3 py-2 text-xs uppercase tracking-wide ${
                nodeType === value ? "bg-black text-white" : "bg-transparent text-black"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-kyar-meta">Photo (optional)</label>
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
        <UnderlineInput label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
        <UnderlineInput label="Tags" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
        <UnderlineInput label="Cost $" type="number" min="0" step="0.01" value={costDollars} onChange={(e) => setCostDollars(e.target.value)} />
        <UnderlineInput label="Source link" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        <UnderlineInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="text-xs text-kyar-danger">{error}</p>}
      </form>
    </BuildDetailModalShell>
  );
}
