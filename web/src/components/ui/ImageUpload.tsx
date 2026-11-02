"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
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
  /**
   * "glass" = light-on-glass drop slot for glass panels and dialogs (ref 13d):
   * dashed add tile that becomes the preview once an image is set, plus an
   * image-link disclosure. "cream" (default) keeps the legacy rendering for
   * callers that still sit on cream surfaces.
   */
  surface?: "cream" | "glass";
  /** Glass only: caption inside the empty tile (e.g. "Cover"). */
  label?: string;
  /**
   * Glass only: content laid out beside a compact 110×140 cover tile (13d puts
   * the name fields here). Without it the tile spans the full width.
   */
  aside?: React.ReactNode;
}

export function ImageUpload({
  onImageSelected,
  category: _category,
  currentImage,
  currentStorageId,
  surface = "cream",
  label,
  aside,
}: ImageUploadProps) {
  const t = useTranslations("Creation");
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
      setError(t("invalidFileType"));
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
        throw new Error(t("uploadFailed"));
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      onImageSelected({ imageStorageId: storageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setError(t("enterUrlError"));
      return;
    }
    try {
      new URL(urlInput);
      onImageSelected({ imageUrl: urlInput.trim() });
      setUrlInput("");
      setError(null);
    } catch {
      setError(t("invalidUrl"));
    }
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
      onChange={handleFileSelect}
      className="hidden"
    />
  );

  if (surface === "glass") {
    const hasImage = Boolean(currentStorageId || currentImage);
    const caption = label ?? t("imageSlot");
    const tile = (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label={hasImage ? `${t("replaceImage")} · ${caption}` : caption}
        className={`group relative flex h-[140px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] px-2 text-center text-media-fg-70 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-60 ${
          hasImage
            ? "border border-glass-border-overlay"
            : "border border-dashed border-glass-border-strong hover:bg-glass-active"
        }`}
      >
        {hasImage ? (
          <>
            {currentStorageId ? (
              <ResolvedImage
                storageId={currentStorageId}
                className="absolute inset-0 h-full w-full object-cover"
                alt={t("currentImageAlt")}
              />
            ) : (
              <img
                src={currentImage}
                alt={t("currentImageAlt")}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-[9px] font-bold uppercase tracking-[0.14em] text-kyar-media-fg">
              {uploading ? t("uploading") : t("replaceImage")}
            </span>
          </>
        ) : uploading ? (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
            {t("uploading")}
          </span>
        ) : (
          <>
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              add_photo_alternate
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em]">{caption}</span>
            {!aside && <span className="text-xs text-media-fg-55">{t("fileTypesShort")}</span>}
          </>
        )}
      </button>
    );

    const toggleClass =
      "inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent";

    return (
      <div>
        {fileInput}
        {aside ? (
          <div className="flex gap-4">
            <div className="w-[110px] shrink-0">{tile}</div>
            <div className="min-w-0 flex-1 space-y-3">{aside}</div>
          </div>
        ) : (
          tile
        )}

        {mode === "file" ? (
          <button
            type="button"
            onClick={() => setMode("url")}
            aria-expanded={false}
            className={toggleClass}
          >
            <span className="border-b border-glass-border-strong pb-0.5">{t("useImageLink")}</span>
          </button>
        ) : (
          <div className="pt-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput ?? ""}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t("urlPlaceholder")}
                aria-label={t("imageUrlLabel")}
                className="glass-field block min-h-[44px] min-w-0 flex-1 px-[13px] py-[11px] text-sm focus-visible:ring-2 focus-visible:ring-kyar-accent"
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar px-[18px] text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                {t("addUrl")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMode("file")}
              aria-expanded
              className={toggleClass}
            >
              <span className="border-b border-glass-border-strong pb-0.5">
                {t("useFileUpload")}
              </span>
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-on-glass-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] border ${
            mode === "file"
              ? "border-kyar-text bg-kyar-muted text-kyar-text"
              : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text"
          }`}
        >
          {t("uploadFile")}
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] border ${
            mode === "url"
              ? "border-kyar-text bg-kyar-muted text-kyar-text"
              : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text"
          }`}
        >
          {t("enterUrl")}
        </button>
      </div>

      {mode === "file" ? (
        <div>
          {fileInput}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-kyar-border hover:border-kyar-text py-8 text-center transition disabled:opacity-50"
          >
            {uploading ? (
              <span className="text-sm uppercase tracking-[0.14em]">{t("uploading")}</span>
            ) : (
              <div>
                <span className="material-symbols-outlined text-3xl block mb-2">cloud_upload</span>
                <span className="text-sm uppercase tracking-[0.14em]">{t("clickToUpload")}</span>
                <p className="text-xs text-kyar-textTertiary mt-1">{t("fileTypesHint")}</p>
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
            placeholder={t("urlPlaceholder")}
            className="flex-1 border-0 border-b border-kyar-border bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 py-2 bg-kyar-text text-kyar-bg text-xs font-bold uppercase tracking-[0.14em] hover:opacity-90"
          >
            {t("addUrl")}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {(currentImage || currentStorageId) && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.14em] mb-2">{t("currentImage")}</p>
          {currentStorageId ? (
            <ResolvedImage
              storageId={currentStorageId}
              className="w-full max-w-xs h-48 object-cover border border-kyar-border"
              alt={t("currentImageAlt")}
            />
          ) : currentImage ? (
            <img
              src={currentImage}
              alt={t("currentImageAlt")}
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
