import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import type { VaultDoc, VaultReader } from "../store";
import type { LocalMutationHandler, LocalQueryHandler } from "../types";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { MAX_LENGTH, clampNumber, sanitizeOptional } from "./lib/validation";

/**
 * Local port of the build media modules: `convex/buildReferenceImages.ts`,
 * `convex/buildProcessPictures.ts` (identical galleries) and `convex/buildProgressUpdates.ts`.
 *
 * Single-owner vault: collaborator/public-viewer checks reduce to "the build exists". Cloud storage
 * accounting, idempotency replay and media indexing are server-only and dropped. Photos are stored as
 * given — a vault photo (`imageUrl` device path / `kyarafit-image:` token, or a `local` ImageRef) or a
 * legacy cloud `imageStorageId`. `publishedToFeed` is an online feed flag: stored as requested, never
 * tier-checked here (the server enforces it if/when the update is replicated).
 */

type Meta = { version?: number; fieldUpdatedAt?: Record<string, number> };

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isBuild(doc: VaultDoc | null): doc is VaultDoc {
  return doc != null && typeof doc.status === "string" && typeof doc.name === "string";
}

function galleryModule(table: "buildReferenceImages" | "buildProcessPictures") {
  const rowsFor = (ctx: { db: VaultReader }, buildId: string) =>
    ctx.db
      .query(table)
      .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
      .collect();

  const queries: Record<string, LocalQueryHandler> = {
    [`${table}:listByBuild`]: (ctx, args) => {
      const build = typeof args.buildId === "string" ? ctx.db.get(args.buildId) : null;
      if (!isBuild(build)) return [];
      return rowsFor(ctx, build._id).sort(
        (a, b) =>
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
          a._creationTime - b._creationTime
      );
    },
  };

  const mutations: Record<string, LocalMutationHandler> = {
    [`${table}:add`]: (ctx, args) => {
      const build = typeof args.buildId === "string" ? ctx.db.get(args.buildId) : null;
      if (!isBuild(build)) throw new Error("Build not found");
      const imageStorageId = str(args.imageStorageId);
      const imageUrl = str(args.imageUrl);
      if (!imageStorageId && !imageUrl) {
        throw new Error("Either imageStorageId or imageUrl is required");
      }
      const existing = rowsFor(ctx, build._id);
      const maxOrder = existing.length
        ? Math.max(...existing.map((r) => Number(r.sortOrder) || 0), -1)
        : -1;
      const id = ctx.db.insert(
        table,
        withCreateMeta(
          {
            userId: ctx.userId,
            buildId: build._id,
            imageStorageId,
            imageUrl,
            sortOrder: maxOrder + 1,
          },
          ctx.now
        )
      );
      return ctx.db.get(id);
    },

    [`${table}:remove`]: (ctx, args) => {
      const doc = typeof args.id === "string" ? ctx.db.get(args.id) : null;
      if (!doc) throw new Error("Not found");
      const build = typeof doc.buildId === "string" ? ctx.db.get(doc.buildId) : null;
      if (!isBuild(build)) throw new Error("Not authorized");
      ctx.db.delete(doc._id);
      return null;
    },

    [`${table}:reorder`]: (ctx, args) => {
      const build = typeof args.buildId === "string" ? ctx.db.get(args.buildId) : null;
      if (!isBuild(build)) throw new Error("Build not found");
      const orderedIds = Array.isArray(args.orderedIds)
        ? args.orderedIds.filter((id): id is string => typeof id === "string")
        : [];
      const existing = rowsFor(ctx, build._id);
      const existingIds = new Set(existing.map((r) => r._id));
      const rowsById = new Map(existing.map((r) => [r._id, r]));
      const orderedSet = new Set(orderedIds);
      const appended = existing.filter((r) => !orderedSet.has(r._id));
      const fullOrder = [
        ...orderedIds.filter((id) => existingIds.has(id)),
        ...appended.map((r) => r._id),
      ];
      for (let i = 0; i < fullOrder.length; i++) {
        const row = rowsById.get(fullOrder[i]);
        ctx.db.patch(fullOrder[i], withUpdateMeta((row ?? {}) as Meta, { sortOrder: i }, ctx.now));
      }
      return null;
    },
  };

  return { queries, mutations };
}

const referenceImages = galleryModule("buildReferenceImages");
const processPictures = galleryModule("buildProcessPictures");

function liveBuild(doc: VaultDoc | null): doc is VaultDoc {
  return isBuild(doc) && doc.deletedAt == null;
}

const progressQueries: Record<string, LocalQueryHandler> = {
  "buildProgressUpdates:listByBuild": (ctx, args) => {
    const build = typeof args.buildId === "string" ? ctx.db.get(args.buildId) : null;
    if (!liveBuild(build)) return [];
    const live = ctx.db
      .query("buildProgressUpdates")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect()
      .filter((r) => r.deletedAt == null);
    // Shared pure ordering: newest-first by createdAt, stable for ties.
    return sortProgressUpdates(
      live.map((r) => ({ ...r, id: r._id, createdAt: Number(r.createdAt) || 0 }))
    );
  },
};

const progressMutations: Record<string, LocalMutationHandler> = {
  "buildProgressUpdates:add": (ctx, args) => {
    const build = typeof args.buildId === "string" ? ctx.db.get(args.buildId) : null;
    if (!liveBuild(build)) throw new Error("Build not found or not authorized");
    const imageRefs = Array.isArray(args.imageRefs) ? args.imageRefs : [];
    if (imageRefs.length > 20) throw new Error("Too many progress images");
    const id = ctx.db.insert(
      "buildProgressUpdates",
      withCreateMeta(
        {
          buildId: build._id,
          userId: ctx.userId,
          createdAt: ctx.now,
          note: sanitizeOptional(str(args.note), MAX_LENGTH.notes, "Note"),
          imageRefs,
          progressPercent: clampNumber(
            args.progressPercent as number | undefined,
            0,
            100,
            "Progress percent"
          ),
          publishedToFeed: args.publish === true,
        },
        ctx.now
      )
    );
    return ctx.db.get(id);
  },

  "buildProgressUpdates:update": (ctx, args) => {
    const doc = typeof args.id === "string" ? ctx.db.get(args.id) : null;
    if (!doc || doc.deletedAt != null || !("imageRefs" in doc)) {
      throw new Error("Progress update not found or not authorized");
    }
    const patch: Record<string, unknown> = {};
    if (args.note !== undefined)
      patch.note =
        args.note === null ? undefined : sanitizeOptional(str(args.note), MAX_LENGTH.notes, "Note");
    if (args.imageRefs !== undefined) {
      const refs = Array.isArray(args.imageRefs) ? args.imageRefs : [];
      if (refs.length > 20) throw new Error("Too many progress images");
      patch.imageRefs = refs;
    }
    if (args.progressPercent !== undefined)
      patch.progressPercent =
        args.progressPercent === null
          ? undefined
          : clampNumber(args.progressPercent as number, 0, 100, "Progress percent");
    if (args.publish !== undefined) patch.publishedToFeed = args.publish === true;

    if (Object.keys(patch).length > 0) {
      ctx.db.patch(doc._id, withUpdateMeta(doc as Meta, patch, ctx.now));
    }
    return ctx.db.get(doc._id);
  },

  "buildProgressUpdates:remove": (ctx, args) => {
    const doc = typeof args.id === "string" ? ctx.db.get(args.id) : null;
    if (!doc || !("imageRefs" in doc)) {
      throw new Error("Progress update not found or not authorized");
    }
    if (doc.deletedAt != null) return null;
    // Soft delete, as on the server, so a replicated vault propagates the removal.
    ctx.db.patch(doc._id, withUpdateMeta(doc as Meta, { deletedAt: ctx.now }, ctx.now));
    return null;
  },
};

export const queries: Record<string, LocalQueryHandler> = {
  ...referenceImages.queries,
  ...processPictures.queries,
  ...progressQueries,
};

export const mutations: Record<string, LocalMutationHandler> = {
  ...referenceImages.mutations,
  ...processPictures.mutations,
  ...progressMutations,
};
