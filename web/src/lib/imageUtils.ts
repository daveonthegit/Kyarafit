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

/** Crop area in pixels (e.g. from react-easy-crop onCropComplete). */
export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const AVATAR_MAX_SIZE = 512;
const AVATAR_JPEG_QUALITY = 0.9;

/**
 * Load an image from a URL (object URL or string) and return as HTMLImageElement.
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/**
 * Options for getCroppedImageBlob.
 * - maxSize: for square output (e.g. avatars); shorter side is capped.
 * - maxWidth + maxHeight: for rectangular output; crop is scaled to fit within both, keeping aspect.
 */
export type GetCroppedImageBlobOptions = {
  maxSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

/**
 * Produce a JPEG blob from a cropped region of an image.
 * Use maxSize for square output (e.g. avatars), or maxWidth+maxHeight for rectangular (e.g. hero).
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: CropArea,
  options?: GetCroppedImageBlobOptions
): Promise<Blob> {
  const quality = options?.quality ?? AVATAR_JPEG_QUALITY;
  const img = await loadImageFromUrl(imageSrc);
  const { x, y, width, height } = crop;

  let scaledW: number;
  let scaledH: number;
  if (
    options?.maxWidth != null &&
    options?.maxHeight != null &&
    options.maxWidth > 0 &&
    options.maxHeight > 0
  ) {
    const scale = Math.min(options.maxWidth / width, options.maxHeight / height);
    scaledW = Math.round(width * scale);
    scaledH = Math.round(height * scale);
  } else {
    const maxSize = options?.maxSize ?? AVATAR_MAX_SIZE;
    const size = Math.min(width, height, maxSize);
    const scale = size / Math.min(width, height);
    scaledW = Math.round(width * scale);
    scaledH = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = scaledW;
  canvas.height = scaledH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, x, y, width, height, 0, 0, scaledW, scaledH);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create image"));
      },
      "image/jpeg",
      quality
    );
  });
}
