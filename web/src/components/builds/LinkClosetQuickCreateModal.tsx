"use client";

import { useState } from "react";
import { useOfflineMutation } from "@/lib/offline";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  type CosplayCategory,
  type CosplayNodeType,
} from "@kyarafit/design-system/types";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PhotoPill } from "@/components/ui/PhotoPill";
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
  const createNode = useOfflineMutation(api.cosplayNodes.create);
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
        tags: tagsStr
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
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
          <PhotoPill
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="min-w-[100px] flex-1 sm:flex-none"
          >
            Cancel
          </PhotoPill>
          <PhotoPill
            type="submit"
            variant="solid"
            form="link-closet-quick-create-form"
            disabled={pending}
            className="min-w-[100px] flex-1 sm:ml-auto sm:flex-none"
          >
            {pending ? "Creating…" : "Create & select"}
          </PhotoPill>
        </>
      }
    >
      <form
        id="link-closet-quick-create-form"
        className="space-y-5"
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
              className={`min-h-[44px] rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                nodeType === value
                  ? "border-transparent bg-glass-solid text-glass-ink"
                  : "border-glass-border-strong text-media-fg-70 hover:bg-glass-active hover:text-kyar-media-fg"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
            Photo (optional)
          </label>
          <ImageUpload
            surface="glass"
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
        <GlassField
          id="link-closet-quick-create-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex max-h-[148px] flex-wrap gap-2 overflow-y-auto">
          {COSPLAY_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`min-h-[44px] rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                category === value
                  ? "border-glass-solid bg-glass-active text-kyar-media-fg"
                  : "border-glass-border text-media-fg-70 hover:bg-glass-active hover:text-kyar-media-fg"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <GlassField
          id="link-closet-quick-create-tags"
          label="Tags"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />
        <GlassField
          id="link-closet-quick-create-cost"
          label="Cost $"
          type="number"
          min="0"
          step="0.01"
          value={costDollars}
          onChange={(e) => setCostDollars(e.target.value)}
        />
        <GlassField
          id="link-closet-quick-create-source"
          label="Source link"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        <GlassField
          id="link-closet-quick-create-notes"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="text-xs text-on-glass-danger">{error}</p>}
      </form>
    </BuildDetailModalShell>
  );
}

/** Labelled glass-outline input (replaces the cream UnderlineInput inside this glass dialog). */
function GlassField({
  id,
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55"
      >
        {label}
      </label>
      <input
        id={id}
        className={`glass-field min-h-[44px] w-full px-3 py-2.5 text-sm ${className}`.trim()}
        {...props}
      />
    </div>
  );
}
