/* eslint-disable @typescript-eslint/no-explicit-any -- Provider fixture wraps Convex's schema-generic registration boundary, not application data. */
import { beforeEach, expect, vi } from "vitest";
import type { convexTest } from "convex-test";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// convex-test's storeBlob primitive persists size/sha256 but omits Blob.type, unlike Convex.
// Model that provider metadata contract, without mocking upload, ownership, quota, or cleanup logic.
const contentTypes = vi.hoisted(() => new Map<string, string>());
beforeEach(() => contentTypes.clear());
export function recordTestBlobType(id: Id<"_storage">, type: string) {
  contentTypes.set(id, type);
}
vi.mock("convex/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("convex/server")>();
  return {
    ...original,
    httpActionGeneric: (handler: Parameters<typeof original.httpActionGeneric>[0]) =>
      original.httpActionGeneric((ctx, request) =>
        handler(
          {
            ...ctx,
            storage: {
              ...ctx.storage,
              store: async (blob, options) => {
                const id = await ctx.storage.store(blob, options);
                contentTypes.set(id, blob.type);
                return id;
              },
            },
          },
          request
        )
      ),
    internalMutationGeneric: (definition: any) => {
      if (typeof definition === "function") return original.internalMutationGeneric(definition);
      return original.internalMutationGeneric({
        ...definition,
        handler: (ctx: any, args: any) =>
          definition.handler(
            {
              ...ctx,
              db: {
                ...ctx.db,
                system: {
                  ...ctx.db.system,
                  get: async (...args: any[]) => {
                    const doc = await ctx.db.system.get(...args);
                    return doc && contentTypes.has(doc._id)
                      ? { ...doc, contentType: contentTypes.get(doc._id) }
                      : doc;
                  },
                  query: (table: string) => {
                    const query = ctx.db.system.query(table);
                    return new Proxy(query, {
                      get(target, property) {
                        if (property === "paginate")
                          return async (options: any) => {
                            const page = await target.paginate(options);
                            return {
                              ...page,
                              page: page.page.map((doc: any) =>
                                contentTypes.has(doc._id)
                                  ? { ...doc, contentType: contentTypes.get(doc._id) }
                                  : doc
                              ),
                            };
                          };
                        return Reflect.get(target, property);
                      },
                    });
                  },
                },
              },
            },
            args
          ),
      });
    },
  };
});

type Harness = ReturnType<typeof convexTest>;
type SessionHarness = ReturnType<Harness["withIdentity"]>;
/** Use the executable upload boundary in fixtures; never assert ownership of an arbitrary id. */
export async function uploadTestBlob(
  t: Harness | SessionHarness,
  actorId: string,
  blob: Blob
): Promise<Id<"_storage">> {
  vi.stubEnv("CONVEX_SITE_URL", "https://fixture.convex.site");
  try {
    const actor = "withIdentity" in t ? t.withIdentity({ subject: actorId }) : t;
    const url = new URL(
      await actor.mutation(api.files.generateUploadUrlForSize, { sizeBytes: blob.size })
    );
    const response = await t.fetch(url.pathname + url.search, {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    expect(response.status).toBe(200);
    return (await response.json()).storageId as Id<"_storage">;
  } finally {
    vi.unstubAllEnvs();
  }
}
