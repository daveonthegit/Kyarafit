/**
 * Supabase Storage helpers for uploading images.
 * All images stored in 'kyarafit-images' bucket with organized folders:
 * - {userId}/closet/ - Closet item images
 * - {userId}/builds/ - Build/character images
 * - {userId}/avatars/ - Profile pictures
 */

import { createClient } from "./client";

const supabase = createClient();

type ImageCategory = "closet" | "builds" | "avatars";

/**
 * Upload an image to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadImage(
  file: File,
  userId: string,
  category: ImageCategory = "closet"
): Promise<string | null> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${userId}/${category}/${fileName}`;

  const { data, error } = await supabase.storage.from("kyarafit-images").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("kyarafit-images").getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImage(publicUrl: string): Promise<boolean> {
  // Extract path from public URL
  // Format: https://.../storage/v1/object/public/kyarafit-images/userId/category/filename.jpg
  const pathMatch = publicUrl.match(/kyarafit-images\/(.+)$/);
  if (!pathMatch) return false;

  const filePath = pathMatch[1];

  const { error } = await supabase.storage.from("kyarafit-images").remove([filePath]);

  return !error;
}
