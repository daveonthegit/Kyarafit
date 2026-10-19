import { useSyncExternalStore } from "react";
import {
  getActiveVault,
  getVaultDataVersion,
  getVaultState,
  subscribeVault,
  type VaultState,
} from "./activeVault";
import { getServerId } from "@/offline/idMap";
import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";

export function useActiveVault() {
  return useSyncExternalStore(subscribeVault, getActiveVault, getActiveVault);
}

export function useOnlineId<T extends string>(id: T | undefined): T | undefined {
  useSyncExternalStore(subscribeVault, getVaultDataVersion, getVaultDataVersion);
  return id?.startsWith(LOCAL_ID_PREFIX) ? ((getServerId(id) as T | null) ?? undefined) : id;
}

/** Reactive vault lifecycle state (booting / locked / unlocked / error). */
export function useVaultState(): VaultState {
  return useSyncExternalStore(subscribeVault, getVaultState, getVaultState);
}
