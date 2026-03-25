import type { Id } from "convex/_generated/dataModel";

/**
 * POST picked image bytes to Convex upload URL; returns storage id from JSON body.
 */
export async function postToConvexUpload(
  uploadUrl: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
  const data = (await response.json()) as { storageId: Id<"_storage"> };
  return data.storageId;
}
