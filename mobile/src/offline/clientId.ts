import * as Crypto from "expo-crypto";
import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";

/**
 * Mint a globally unique id for a vault row. The id is permanent: managed sync replicates the row
 * under this same id (no server ids, no id map), and a published server copy is mapped to it in
 * `id_map` (see `@/vault/publications`).
 */
export function newClientId(): string {
  try {
    return `${LOCAL_ID_PREFIX}${Crypto.randomUUID()}`;
  } catch {
    return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
