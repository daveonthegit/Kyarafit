import type { QueryCtx } from "../_generated/server";
import { deletionJob } from "./deletionReferences";

export async function availableOwnedDocument<T extends { userId: string } | { createdBy: string }>(
  ctx: QueryCtx,
  document: T | null
): Promise<T | null> {
  if (!document) return null;
  const ownerId = "createdBy" in document ? document.createdBy : document.userId;
  return (await deletionJob(ctx, ownerId)) ? null : document;
}
