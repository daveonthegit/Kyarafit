import { v } from "convex/values";

/**
 * `ImageRef` validator (DATA_AND_SYNC.md §7, REQ-D70): a discriminated union describing where an
 * image's binary lives. Reused by schema table definitions and by mutation arg validation so the
 * shape cannot drift between storage and the API surface.
 *
 *   - `{ kind: "local",  uri, imageKey }`        → device file/blob (free durable home).
 *   - `{ kind: "url",    url }`                  → external URL.
 *   - `{ kind: "cloud",  storageId, imageKey }`  → Convex storage (paid backup/cache).
 */
export const imageRefValidator = v.union(
  v.object({
    kind: v.literal("local"),
    uri: v.string(),
    imageKey: v.string(),
  }),
  v.object({
    kind: v.literal("url"),
    url: v.string(),
  }),
  v.object({
    kind: v.literal("cloud"),
    storageId: v.id("_storage"),
    imageKey: v.string(),
  })
);
