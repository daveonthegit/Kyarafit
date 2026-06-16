import * as Crypto from "expo-crypto";
import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";

/**
 * Mint a temporary, locally-unique id for an entity created offline (blueprint §3.13.3). The
 * `local:` prefix marks it as not-yet-synced so the sync worker can rewrite references to it once
 * the create replays and the server returns the real document id (see `./idMap`, `offlineIdMap`).
 */
export function newClientId(): string {
  try {
    return `${LOCAL_ID_PREFIX}${Crypto.randomUUID()}`;
  } catch {
    return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
