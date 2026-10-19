import type { VaultReader } from "../store";
import type { LocalMutationHandler, LocalQueryHandler } from "../types";

/**
 * Device-local per-account preferences that the server keeps on the `users` row. Locally they live
 * in the vault's `vaultSettings` table (one document per key) so the home screen works offline.
 */

const FOCUSED_BUILD_KEY = "focusedBuildId";

function settingDoc(db: VaultReader, key: string) {
  return (
    db
      .query("vaultSettings")
      .collect()
      .find((doc) => doc.key === key) ?? null
  );
}

/** The focused build id when it still points at a live build of this vault, else null. */
export function getFocusedBuildId(db: VaultReader): string | null {
  const value = settingDoc(db, FOCUSED_BUILD_KEY)?.value;
  if (typeof value !== "string") return null;
  const build = db.get(value);
  return build && "status" in build && "name" in build ? value : null;
}

export const queries: Record<string, LocalQueryHandler> = {
  "users:getFocusedBuildId": ({ db }) => getFocusedBuildId(db),
};

export const mutations: Record<string, LocalMutationHandler> = {
  "users:setFocusedBuild": ({ db }, args) => {
    const buildId = typeof args.buildId === "string" ? args.buildId : undefined;
    if (buildId !== undefined) {
      const build = db.get(buildId);
      if (!build || !("status" in build)) return null;
    }
    const existing = settingDoc(db, FOCUSED_BUILD_KEY);
    if (existing) {
      if (buildId === undefined) db.delete(existing._id);
      else db.patch(existing._id, { value: buildId });
      return existing._id;
    }
    if (buildId === undefined) return null;
    return db.insert("vaultSettings", { key: FOCUSED_BUILD_KEY, value: buildId });
  },
};

export const DEVICE_LOCAL = ["users:setFocusedBuild"] as const;
