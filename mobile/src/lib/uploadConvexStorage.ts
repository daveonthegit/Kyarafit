import type { Id } from "convex/_generated/dataModel";

/** POST local file blob to Convex `generateUploadUrl` target; returns storage id. */
export async function uploadUriToConvexStorage(
  localUri: string,
  uploadUrl: string,
  contentType = "image/jpeg"
): Promise<Id<"_storage">> {
  const picked = await fetch(localUri);
  const blob = await picked.blob();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  const json = (await res.json()) as { storageId: Id<"_storage"> };
  if (!json.storageId) {
    throw new Error("Upload response missing storageId");
  }
  return json.storageId;
}
