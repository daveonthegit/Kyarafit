/**
 * Paid image upload-on-sync planning (DATA_AND_SYNC.md §7, REQ-D70/D71).
 *
 * Free users NEVER upload: their local `ImageRef` is the durable home (REQ-D70), so this module is
 * only ever driven by the paid sync worker. For paid users, mirroring a local image to Convex
 * storage is a SYNC STEP: on drain, the local file is uploaded and the entity's `ImageRef` is
 * flipped from `local` to `cloud` while the local copy is kept as a cache (REQ-D71).
 *
 * This module is PURE (no platform / network / React deps): it finds the local `ImageRef`s on an
 * entity doc that a paid user should mirror, and builds the idempotent mutation that flips one from
 * local to cloud once its bytes have been uploaded. The per-platform sync workers own connectivity,
 * single-flight, reading bytes from the local image store, and issuing the upload URL / POST — see
 * `web/src/lib/offline/syncWorker.ts` and `mobile/src/offline/syncWorker.ts`.
 */
import type { ImageRef } from "./imageRef";

type LocalImageRef = Extract<ImageRef, { kind: "local" }>;
type CloudImageRef = Extract<ImageRef, { kind: "cloud" }>;

/**
 * Local-first tables whose docs carry `ImageRef`(s) that participate in paid cloud mirroring. Keep
 * in parity with the `imageRefValidator` fields in `convex/schema.ts`: `buildProgressUpdates.imageRefs`
 * (array).
 */
export const IMAGE_REF_TABLES = ["buildProgressUpdates"] as const;
export type ImageRefTable = (typeof IMAGE_REF_TABLES)[number];

/** The idempotent update mutation that flips an `ImageRef` from local→cloud, per mirroring table. */
const MIRROR_MUTATION: Record<ImageRefTable, string> = {
  buildProgressUpdates: "buildProgressUpdates:update",
};

/** True for the tables this module knows how to mirror. */
export function isImageRefTable(table: string): table is ImageRefTable {
  return (IMAGE_REF_TABLES as readonly string[]).includes(table);
}

/** A single local `ImageRef` found on an entity that a paid user should mirror to cloud (REQ-D71). */
export interface LocalImageRefSite {
  table: ImageRefTable;
  /** Server document id of the owning entity. */
  entityId: string;
  /** Owner (Better Auth externalId), for the ownership-checked flip mutation. */
  userId: string;
  /** Durable local handle used to read the bytes from the platform local image store. */
  imageKey: string;
  /** The local `ImageRef` itself. */
  ref: LocalImageRef;
  /** Index within an array-valued `imageRefs` field, or `null` for a single `imageRef` field. */
  index: number | null;
}

function isLocalRef(value: unknown): value is LocalImageRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "local" &&
    typeof (value as { imageKey?: unknown }).imageKey === "string"
  );
}

/**
 * Find every `local` `ImageRef` on an entity doc that a paid user should mirror to cloud. Returns
 * an empty list for non-mirroring tables, soft-deleted rows, docs without a server id/owner, and
 * `url`/`cloud` refs (already resolved or non-local). Both the single `imageRef` field and each
 * entry of an `imageRefs` array are reported.
 */
export function collectLocalImageRefs(
  table: string,
  doc: Record<string, unknown>
): LocalImageRefSite[] {
  if (!isImageRefTable(table)) return [];
  const entityId = doc._id;
  const userId = doc.userId;
  if (typeof entityId !== "string" || typeof userId !== "string") return [];
  // Never upload for a tombstoned row — it is on its way out (DATA_AND_SYNC.md §4).
  if (doc.deletedAt != null) return [];

  const sites: LocalImageRefSite[] = [];
  if (isLocalRef(doc.imageRef)) {
    sites.push({
      table,
      entityId,
      userId,
      imageKey: doc.imageRef.imageKey,
      ref: doc.imageRef,
      index: null,
    });
  }
  if (Array.isArray(doc.imageRefs)) {
    doc.imageRefs.forEach((ref, index) => {
      if (isLocalRef(ref)) {
        sites.push({ table, entityId, userId, imageKey: ref.imageKey, ref, index });
      }
    });
  }
  return sites;
}

/** The idempotent flip mutation to run + the entity doc to write back locally after mirroring. */
export interface CloudMirrorPlan {
  /** Convex function name for the ownership-checked, idempotent flip mutation. */
  fn: string;
  /** Args for the flip mutation. */
  args: Record<string, unknown>;
  /** The entity doc with the local ref replaced by the cloud ref, to write back to the local store. */
  nextDoc: Record<string, unknown>;
}

/**
 * Plan the local→cloud flip for one uploaded image: build the idempotent update mutation call and
 * the next local doc (local ref replaced by the cloud ref, all other refs preserved). The local
 * binary is intentionally kept as a cache (REQ-D71); only the reference changes.
 *
 * `doc` should be the CURRENT working copy so multiple flips on the same array-valued row compose:
 * pass the previous plan's `nextDoc` back in when mirroring a second ref on the same entity.
 */
export function planCloudMirror(
  site: LocalImageRefSite,
  doc: Record<string, unknown>,
  storageId: string
): CloudMirrorPlan {
  const cloudRef: CloudImageRef = { kind: "cloud", storageId, imageKey: site.imageKey };
  const fn = MIRROR_MUTATION[site.table];

  if (site.index === null) {
    return {
      fn,
      args: { id: site.entityId, userId: site.userId, imageRef: cloudRef },
      nextDoc: { ...doc, imageRef: cloudRef },
    };
  }

  const current = Array.isArray(doc.imageRefs) ? (doc.imageRefs as ImageRef[]) : [];
  const nextRefs = current.map((ref, index) => (index === site.index ? cloudRef : ref));
  return {
    fn,
    args: { id: site.entityId, userId: site.userId, imageRefs: nextRefs },
    nextDoc: { ...doc, imageRefs: nextRefs },
  };
}
