"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { getCroppedImageBlob, type CropArea } from "@/lib/imageUtils";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";

type ProfilePictureCropModalProps = {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
  onError?: (message: string) => void;
};

export function ProfilePictureCropModal({
  open,
  imageSrc,
  onClose,
  onConfirm,
  onError,
}: ProfilePictureCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const cropArea: CropArea = {
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      };
      const blob = await getCroppedImageBlob(imageSrc, cropArea);
      onConfirm(blob);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to crop image");
    } finally {
      setSaving(false);
    }
  }, [imageSrc, croppedAreaPixels, onConfirm, onClose, onError]);

  return (
    <AdaptiveModal open={open} onClose={onClose} aria-labelledby="profile-crop-title">
      <div className="flex flex-col">
        <h2 id="profile-crop-title" className="text-lg font-serif font-medium px-4 pt-4 pb-2">
          Crop profile picture
        </h2>
        <div className="relative w-full h-[min(60vh,400px)] bg-kyar-mutedWarm">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
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
        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-kyar-text border border-kyar-cardBorder rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
            className="px-4 py-2 text-sm font-medium bg-kyar-text text-kyar-bg rounded-sm hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </AdaptiveModal>
  );
}
