import { useCallback, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import {
  getActiveVault,
  getVaultDataVersion,
  getVaultState,
  subscribeVault,
  type VaultState,
} from "./activeVault";
import {
  getLocalIdForPublished,
  getPublishedId,
  publishVaultRow,
  type PublishableTable,
} from "./publications";
import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";

export function useActiveVault() {
  return useSyncExternalStore(subscribeVault, getActiveVault, getActiveVault);
}

/** The published server copy of a vault row (online social features), once it has one. */
export function useOnlineId<T extends string>(id: T | undefined): T | undefined {
  useSyncExternalStore(subscribeVault, getVaultDataVersion, getVaultDataVersion);
  return id?.startsWith(LOCAL_ID_PREFIX) ? ((getPublishedId(id) as T | null) ?? undefined) : id;
}

/** The vault row behind a published server id (links that carry a server id). */
export function useLocalId<T extends string>(id: T | undefined): T | undefined {
  useSyncExternalStore(subscribeVault, getVaultDataVersion, getVaultDataVersion);
  return id && !id.startsWith(LOCAL_ID_PREFIX)
    ? ((getLocalIdForPublished(id) as T | null) ?? id)
    : id;
}

/** Reactive vault lifecycle state (booting / locked / unlocked / error). */
export function useVaultState(): VaultState {
  return useSyncExternalStore(subscribeVault, getVaultState, getVaultState);
}

/** Explicitly publish (or refresh) a vault row's server copy; resolves to its server id. */
export function usePublishVaultRow(): (
  table: PublishableTable,
  localId: string
) => Promise<string> {
  const convex = useConvex();
  return useCallback(
    (table: PublishableTable, localId: string) => publishVaultRow(convex, table, localId),
    [convex]
  );
}
