"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ImageGallery } from "@/components/ui/image-gallery";
import type { ImageGalleryItem } from "@/components/ui/image-gallery";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { X } from "lucide-react";

function ResolveBuildImageUrl({
  doc,
  onResolved,
}: {
  doc: {
    _id: Id<"buildReferenceImages">;
    imageStorageId?: Id<"_storage">;
    imageUrl?: string;
  };
  onResolved: (id: string, url: string) => void;
}) {
  const resolvedUrl = useQuery(
    api.files.getUrl,
    doc.imageStorageId ? { storageId: doc.imageStorageId } : "skip"
  );
  const url = doc.imageStorageId ? resolvedUrl : doc.imageUrl;
  useEffect(() => {
    if (url) onResolved(doc._id, url);
  }, [doc._id, doc.imageStorageId, doc.imageUrl, url, onResolved]);
  return null;
}

export function BuildReferenceImagesSection({
  buildId,
  userId,
}: {
  buildId: Id<"builds">;
  userId: string;
}) {
  const list = useOfflineQuery(api.buildReferenceImages.listByBuild, { buildId });
  const addMutation = useOfflineMutation(api.buildReferenceImages.add);
  const removeMutation = useOfflineMutation(api.buildReferenceImages.remove);
  const reorderMutation = useOfflineMutation(api.buildReferenceImages.reorder);

  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const onResolved = (id: string, url: string) => {
    setResolvedUrls((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }));
  };

  const images: ImageGalleryItem[] =
    list
      ?.map((doc) => ({
        id: doc._id,
        src: resolvedUrls[doc._id] ?? doc.imageUrl ?? "",
        alt: "Reference image",
        ratio: 4 / 3,
      }))
      .filter((i) => i.src) ?? [];

  const handleAdd = (result: { imageStorageId?: Id<"_storage">; imageUrl?: string }) => {
    setAddError(null);
    addMutation({
      buildId,
      userId,
      imageStorageId:
        "imageStorageId" in result && result.imageStorageId ? result.imageStorageId : undefined,
      imageUrl: "imageUrl" in result && result.imageUrl ? result.imageUrl : undefined,
    })
      .then(() => setUploadModalOpen(false))
      .catch((e) => setAddError(e instanceof Error ? e.message : "Failed to add"));
  };

  const handleRemove = (id: string) => {
    setRemoveError(null);
    removeMutation({ id: id as Id<"buildReferenceImages">, userId }).catch((e) =>
      setRemoveError(e instanceof Error ? e.message : "Failed to remove")
    );
  };

  const handleReorder = (orderedIds: string[]) => {
    reorderMutation({
      buildId,
      userId,
      orderedIds: orderedIds as Id<"buildReferenceImages">[],
    }).catch(() => {});
  };

  if (list === undefined) {
    return (
      <div>
        <h2 className="font-serif text-xl italic border-b border-kyar-border pb-2 mb-4">
          Reference images
        </h2>
        <p className="text-sm text-kyar-textTertiary">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      {list.map((doc) => (
        <ResolveBuildImageUrl key={doc._id} doc={doc} onResolved={onResolved} />
      ))}
      {removeError && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {removeError}
        </p>
      )}
      <ImageGallery
        images={images}
        title="Reference images"
        emptyMessage="No reference images. Add one to get started."
        maxInline={6}
        onRemove={handleRemove}
        onReorder={handleReorder}
        onOpenAddPhoto={() => setUploadModalOpen(true)}
      />
      {/* Upload modal (portaled above gallery) */}
      {uploadModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-kyar-text/45 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-reference-modal-title"
          >
            <div className="bg-kyar-surface max-w-lg w-full rounded border border-kyar-borderSubtle shadow-lg flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-kyar-border px-4 py-3 shrink-0">
                <h2
                  id="upload-reference-modal-title"
                  className="font-serif text-lg italic font-bold"
                >
                  Add reference image
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setUploadModalOpen(false);
                    setAddError(null);
                  }}
                  className="p-2 rounded-sm hover:bg-kyar-muted text-kyar-textSecondary focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto">
                <ImageUpload category="builds" onImageSelected={handleAdd} />
                {addError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {addError}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
