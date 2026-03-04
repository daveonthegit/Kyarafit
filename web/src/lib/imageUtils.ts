/**
 * Client-side image processing for upload: resize to max 1080p, compress, strip metadata.
 * Uses canvas (re-encoding strips EXIF). No file size limit; any size allowed.
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.85;

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"] as const;

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number]);
}

/**
 * Load a file as an HTMLImageElement (for canvas drawing).
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Resize dimensions to fit within max 1080p while keeping aspect ratio.
 */
function fitWithin(
  width: number,
  height: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  if (width <= maxW && height <= maxH) return { width, height };
  const scale = Math.min(maxW / width, maxH / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Process image for upload: resize to max 1920×1080 if larger, compress as JPEG, strip metadata.
 * Returns a Blob (JPEG). Accepts any image size.
 */
export async function processImageForUpload(file: File): Promise<Blob> {
  if (!isAllowedImageType(file.type)) {
    throw new Error("Invalid file type. Allowed: JPG, PNG, WebP, GIF");
  }

  const img = await loadImage(file);
  const { width: w, height: h } = img;
  const { width: dw, height: dh } = fitWithin(w, h, MAX_WIDTH, MAX_HEIGHT);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, dw, dh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to compress image"));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
