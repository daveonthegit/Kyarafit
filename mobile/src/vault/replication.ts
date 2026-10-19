import { getOfflineDb, isVaultOpen } from "@/offline/db";

/**
 * Whether local writes in the open vault also record a durable replication intent for Kyarafit
 * Cloud (paid sync). Free vaults never queue anything — their data lives only on the device until
 * the user exports it or upgrades (the upgrade backfill then copies the whole vault up once).
 *
 * The flag is persisted per vault so a paid user who launches offline (tier not yet re-validated)
 * keeps queueing their edits instead of silently dropping them from sync. The sync worker updates it
 * whenever the server reports the account's tier.
 */

const KEY = "replication:enabled";
let cachedFor: string | null = null;
let cached = false;

function vaultMarker(): string | null {
  if (!isVaultOpen()) return null;
  try {
    return (
      getOfflineDb().getFirstSync<{ value: string }>(
        "SELECT value FROM sync_meta WHERE key = 'vault:subject'"
      )?.value ?? null
    );
  } catch {
    return null;
  }
}

export function isReplicationEnabled(): boolean {
  const marker = vaultMarker();
  if (!marker) return false;
  if (cachedFor === marker) return cached;
  const row = getOfflineDb().getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = ?",
    [KEY]
  );
  cachedFor = marker;
  cached = row?.value === "1";
  return cached;
}

export function setReplicationEnabled(enabled: boolean): void {
  const marker = vaultMarker();
  if (!marker) return;
  getOfflineDb().runSync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEY, enabled ? "1" : "0"]
  );
  cachedFor = marker;
  cached = enabled;
}

const syncRequestListeners = new Set<() => void>();

/** Ask the (paid) sync worker to drain soon — called after every replicated local commit. */
export function requestReplication(): void {
  for (const listener of syncRequestListeners) listener();
}

export function onReplicationRequested(listener: () => void): () => void {
  syncRequestListeners.add(listener);
  return () => {
    syncRequestListeners.delete(listener);
  };
}
