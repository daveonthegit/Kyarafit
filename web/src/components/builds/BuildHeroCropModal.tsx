"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";

/** Hero aspect ratio (wide) for focus/build card. */
const HERO_ASPECT = 21 / 9;

export type FocalPoint = { x: number; y: number };

export type BuildHeroCropModalProps = {
  open: boolean;
  imageSrc: string;
  buildName: string;
  /** Current focal point 0–1 (optional, to pre-position the frame). */
  initialFocal?: FocalPoint | null;
  onClose: () => void;
  /** Called with focal point (0–1); image is not replaced, only position is saved. */
  onConfirm: (focalPoint: FocalPoint) => void;
  onError?: (message: string) => void;
  error?: string | null;
};

export function BuildHeroCropModal({
  open,
  imageSrc,
  buildName,
  initialFocal,
  onClose,
  onConfirm,
  onError,
  error: errorMessage,
}: BuildHeroCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  /** Relative crop area (0–1); use this for focal point so zoom is correct. */
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !imageSrc) {
      setImageSize(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => setImageSize(null);
    img.src = imageSrc;
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !imageSize || !initialFocal) return;
    const w = imageSize.width;
    const h = imageSize.height;
    const cropWPx = Math.min(w, h * HERO_ASPECT);
    const cropHPx = cropWPx / HERO_ASPECT;
    const cropW = cropWPx / w;
    const cropH = cropHPx / h;
    const x = Math.max(0, Math.min(1 - cropW, initialFocal.x - cropW / 2));
    const y = Math.max(0, Math.min(1 - cropH, initialFocal.y - cropH / 2));
    setCrop({ x, y });
  }, [open, imageSize, initialFocal]);

  const onCropComplete = useCallback((croppedAreaRel: Area, _croppedAreaPx: Area) => {
    setCroppedArea(croppedAreaRel);
  }, []);

  const handleSave = useCallback(() => {
    if (!croppedArea) return;
    setSaving(true);
    try {
      // Use relative crop area (0–100 in library) so focal point is correct at any zoom.
      const scale = 100;
      const x = Math.max(0, Math.min(1, (croppedArea.x + croppedArea.width / 2) / scale));
      const y = Math.max(0, Math.min(1, (croppedArea.y + croppedArea.height / 2) / scale));
      onConfirm({ x, y });
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to save position");
    } finally {
      setSaving(false);
    }
  }, [croppedArea, onConfirm, onClose, onError]);

  return (
    <AdaptiveModal open={open} onClose={onClose} aria-labelledby="hero-crop-title">
      <div className="flex flex-col">
        <h2 id="hero-crop-title" className="text-lg font-serif font-medium px-4 pt-4 pb-2">
          Position hero image
        </h2>
        <p className="text-sm text-kyar-textSecondary px-4 pb-2 truncate" title={buildName}>
          {buildName}
        </p>
        <div className="relative w-full h-[min(50vh,320px)] bg-kyar-mutedWarm">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={HERO_ASPECT}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { backgroundColor: "var(--kyar-mutedWarm)" },
              cropAreaStyle: {
                border: "2px solid white",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
              },
            }}
          />
        </div>
        <div className="px-4 py-2">
          <label className="text-[11px] uppercase tracking-widest text-kyar-textSecondary block mb-1">
            Zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-2 accent-black"
          />
        </div>
        {errorMessage && (
          <p className="mx-4 mb-2 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-kyar-text border border-kyar-cardBorder rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedArea}
            className="px-4 py-2 text-sm font-medium bg-black text-white rounded-sm hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </AdaptiveModal>
  );
}
