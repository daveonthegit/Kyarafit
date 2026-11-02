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
        <h2 id="profile-crop-title" className="text-lg font-serif italic px-4 pt-4 pb-2">
          Crop profile picture
        </h2>
        <div className="relative w-full h-[min(60vh,400px)]">
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
              containerStyle: { backgroundColor: "rgb(12 11 20 / 0.6)" },
              cropAreaStyle: {
                border: "2px solid white",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
              },
            }}
          />
        </div>
        <div className="px-4 py-2">
          <label className="text-[10px] uppercase tracking-[0.16em] text-media-fg-70 block mb-1">
            Zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-2 accent-kyar-accent"
          />
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
            className="px-4 py-2 min-h-[44px] text-[10px] font-bold uppercase tracking-[0.16em] bg-glass-solid text-glass-ink rounded-full hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </AdaptiveModal>
  );
}
