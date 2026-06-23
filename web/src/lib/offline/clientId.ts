import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";

/**
 * Mint a temporary, locally-unique id for an entity created offline (DATA_AND_SYNC.md §4, REQ-D41).
 * The `local:` prefix marks it as not-yet-synced so the sync worker can rewrite references to it once
 * the create replays and the server returns the real document id (see `./syncWorker`, `offlineIdMap`).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
export function newClientId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return `${LOCAL_ID_PREFIX}${globalThis.crypto.randomUUID()}`;
    }
  } catch {
    // fall through to the time-based fallback
  }
  return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
