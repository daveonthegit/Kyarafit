import { useMemo, useSyncExternalStore } from "react";
import {
  getActiveReplicator,
  getActiveVault,
  getActiveVaultSql,
  getVaultDataVersion,
  subscribeVault,
} from "../activeVault";
import { countChangesNotApplied, listChangesNotApplied, type ChangeNotApplied } from "./conflicts";
import type { Replicator, ReplicaStatus } from "./replicator";

/** What Settings shows for managed sync. */
export interface ReplicaSummary {
  enabled: boolean;
  status: ReplicaStatus;
  /** Local changes not yet acknowledged by Kyarafit Cloud. */
  pending: number;
  lastSyncedAt: number | null;
  /** Open "changes that didn't apply". */
  changes: number;
}

const DISABLED: ReplicaSummary = {
  enabled: false,
  status: "disabled",
  pending: 0,
  lastSyncedAt: null,
  changes: 0,
};

let version = 0;
let watched: Replicator | null = null;
let unwatch: (() => void) | null = null;
const listeners = new Set<() => void>();

function bump(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function watchReplicator(): void {
  const current = getActiveReplicator();
  if (current === watched) return;
  unwatch?.();
  watched = current;
  unwatch = current ? current.subscribe(bump) : null;
}

let vaultUnsubscribe: (() => void) | null = null;

/** Changes whenever the vault, its replicator, or the replicator's state changes. */
export function subscribeReplica(listener: () => void): () => void {
  listeners.add(listener);
  if (!vaultUnsubscribe) {
    vaultUnsubscribe = subscribeVault(() => {
      watchReplicator();
      bump();
    });
    watchReplicator();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      vaultUnsubscribe?.();
      vaultUnsubscribe = null;
      unwatch?.();
      unwatch = null;
      watched = null;
    }
  };
}

function replicaVersion(): number {
  return version + getVaultDataVersion();
}

let cachedAt = -1;
let cached: ReplicaSummary = DISABLED;

export function getReplicaSummary(): ReplicaSummary {
  const at = replicaVersion();
  if (at === cachedAt) return cached;
  cachedAt = at;
  const replicator = getActiveReplicator();
  const sql = getActiveVaultSql();
  if (!replicator || !sql) {
    cached = DISABLED;
    return cached;
  }
  try {
    cached = {
      enabled: replicator.enabled,
      status: replicator.status,
      pending: replicator.pendingCount(),
      lastSyncedAt: replicator.lastSyncedAt,
      changes: countChangesNotApplied(sql),
    };
  } catch {
    cached = DISABLED;
  }
  return cached;
}

export function useReplicaSummary(): ReplicaSummary {
  return useSyncExternalStore(subscribeReplica, getReplicaSummary, getReplicaSummary);
}

/** Open "changes that didn't apply", newest first (one build's, when `buildId` is given). */
export function useChangesNotApplied(buildId?: string): ChangeNotApplied[] {
  const at = useSyncExternalStore(subscribeReplica, replicaVersion, replicaVersion);
  return useMemo(() => {
    const sql = getActiveVaultSql();
    const store = getActiveVault();
    if (!sql || !store) return [];
    try {
      return listChangesNotApplied(sql, store.reader(), buildId);
    } catch {
      return [];
    }
    // `at` re-derives the list whenever the vault or the replicator changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, buildId]);
}
