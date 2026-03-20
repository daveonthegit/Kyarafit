"use client";

import { useState, useEffect, useRef } from "react";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
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
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto sm:ml-auto px-6 py-2.5 bg-kyar-text text-white text-xs font-bold uppercase tracking-wider rounded-md"
        >
          Done
        </button>
      }
    >
      <p className="text-sm text-kyar-textSecondary mb-4">
        Upload or paste a URL. You can add many in a row; close when finished.
      </p>
      {feedback && (
        <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <ImageUpload key={uploadKey} category="builds" onImageSelected={handleSelected} />
    </BuildDetailModalShell>
  );
}
