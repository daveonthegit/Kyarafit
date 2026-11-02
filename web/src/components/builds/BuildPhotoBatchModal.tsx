"use client";

import { useState, useEffect, useRef } from "react";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PhotoPill } from "@/components/ui/PhotoPill";
import type { Id } from "convex/_generated/dataModel";

type PhotoKind = "reference" | "progress";

type BuildPhotoBatchModalProps = {
  open: boolean;
  kind: PhotoKind | null;
  onClose: () => void;
  onImageSelected: (result: {
    imageStorageId?: Id<"_storage">;
    imageUrl?: string;
  }) => Promise<void>;
};

export function BuildPhotoBatchModal({
  open,
  kind,
  onClose,
  onImageSelected,
}: BuildPhotoBatchModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current && kind) {
      setFeedback(null);
      setError(null);
      setUploadKey((k) => k + 1);
    }
    prevOpen.current = open;
  }, [open, kind]);

  const title =
    kind === "reference"
      ? "Add reference images"
      : kind === "progress"
        ? "Add progress photos"
        : "";

  const handleSelected = async (result: { imageStorageId?: Id<"_storage">; imageUrl?: string }) => {
    setError(null);
    setFeedback(null);
    try {
      await onImageSelected(result);
      setFeedback(
        kind === "reference"
          ? "Reference added — add another below."
          : "Photo added — add another below."
      );
      setUploadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  if (!open || !kind) return null;

  return (
    <BuildDetailModalShell
      open
      onClose={onClose}
      title={title}
      titleId="build-photo-batch-title"
      size="lg"
      footer={
        <PhotoPill
          type="button"
          variant="solid"
          onClick={onClose}
          className="w-full sm:ml-auto sm:w-auto"
        >
          Done
        </PhotoPill>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-media-fg-70">
        Upload or paste a URL. You can add many in a row; close when finished.
      </p>
      {feedback && (
        <p className="mb-3 rounded-[10px] bg-on-glass-chip-done-bg px-3 py-2 text-[13px] text-on-glass-chip-done-fg">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-on-glass-danger" role="alert">
          {error}
        </p>
      )}
      <ImageUpload
        surface="glass"
        key={uploadKey}
        category="builds"
        onImageSelected={handleSelected}
      />
    </BuildDetailModalShell>
  );
}
