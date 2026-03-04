"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { processImageForUpload, isAllowedImageType } from "@/lib/imageUtils";

export type ImageUploadResult =
  | { imageStorageId: Id<"_storage">; imageUrl?: undefined }
  | { imageUrl: string; imageStorageId?: undefined };

interface ImageUploadProps {
  onImageSelected: (result: ImageUploadResult) => void;
  category: "builds" | "conventions" | "closet";
  currentImage?: string;
  /** When we have a Convex storage ID, pass it here so we can show a preview via getUrl */
  currentStorageId?: Id<"_storage">;
}

export function ImageUpload({
  onImageSelected,
  category: _category,
  currentImage,
  currentStorageId,
}: ImageUploadProps) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedImageType(file.type)) {
      setError("Invalid file type. Please upload: JPG, PNG, WebP, or GIF");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const blob = await processImageForUpload(file);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      onImageSelected({ imageStorageId: storageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }
    try {
      new URL(urlInput);
      onImageSelected({ imageUrl: urlInput.trim() });
      setUrlInput("");
      setError(null);
    } catch {
      setError("Invalid URL format");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
            mode === "file"
              ? "border-black bg-kyar-muted text-black"
              : "border-kyar-border text-kyar-textTertiary hover:border-black"
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
            mode === "url"
              ? "border-black bg-kyar-muted text-black"
              : "border-kyar-border text-kyar-textTertiary hover:border-black"
          }`}
        >
          Enter URL
        </button>
      </div>

      {mode === "file" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-kyar-border hover:border-black py-8 text-center transition disabled:opacity-50"
          >
            {uploading ? (
              <span className="text-sm uppercase tracking-wider">
                Processing &amp; uploading...
              </span>
            ) : (
              <div>
                <span className="material-symbols-outlined text-3xl block mb-2">cloud_upload</span>
                <span className="text-sm uppercase tracking-wider">Click to upload image</span>
                <p className="text-xs text-kyar-textTertiary mt-1">
                  JPG, PNG, WebP, GIF (any size — resized to 1080p and compressed)
                </p>
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput ?? ""}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-gray-800"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {(currentImage || currentStorageId) && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider mb-2">Current Image:</p>
          {currentStorageId ? (
            <ResolvedImage
              storageId={currentStorageId}
              className="w-full max-w-xs h-48 object-cover border border-kyar-border"
              alt="Current"
            />
          ) : currentImage ? (
            <img
              src={currentImage}
              alt="Current"
              className="w-full max-w-xs h-48 object-cover border border-kyar-border"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Renders an img using Convex storage URL (for preview when we only have storageId). */
function ResolvedImage({
  storageId,
  alt,
  className,
}: {
  storageId: Id<"_storage">;
  alt: string;
  className?: string;
}) {
  const url = useQuery(api.files.getUrl, { storageId });
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}
