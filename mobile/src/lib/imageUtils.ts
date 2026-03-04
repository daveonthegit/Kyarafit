/**
 * Resize image to max 1080p (1920×1080) and compress before upload/save.
 * Uses expo-image-manipulator; strips metadata via re-encode to JPEG.
 */

import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const COMPRESS = 0.85;

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

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

/**
 * Process image: resize to fit within 1080p if larger, compress as JPEG.
 * Returns the URI of the processed image (saved to cache).
 */
export async function processImageForUpload(uri: string): Promise<string> {
  const { width, height } = await getImageDimensions(uri);
  const { width: dw, height: dh } = fitWithin(width, height, MAX_WIDTH, MAX_HEIGHT);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: dw, height: dh } }],
    { compress: COMPRESS, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
