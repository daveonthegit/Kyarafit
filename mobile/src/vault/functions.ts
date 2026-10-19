import { newIdempotencyKey } from "@/offline/idempotencyKey";
import { isCreateMutation } from "@/offline/offlineCreateMutations";
import { getActiveVault, requireActiveVault } from "./activeVault";
import { toPortableImageRefs } from "./images";
import { isReplicationEnabled, requestReplication } from "./replication";
import { VaultWriteError, type VaultStore } from "./store";
import { LOCAL_MUTATIONS, LOCAL_QUERIES, DEVICE_LOCAL_MUTATIONS } from "./handlers";

/**
 * The seam between screens and personal data.
 *
 * Screens still name a function (`api.builds.list`) because that is how the existing UI addresses
 * data, but for every personal-data function registered here the name is only a command key: the
 * local handler runs against the unlocked vault and NO Convex call is made — online or offline,
 * free or paid. Paid sync, when enabled, records a durable replication intent inside the same
 * SQLite transaction and the sync worker replays it later.
 */

export function hasLocalQuery(fn: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOCAL_QUERIES, fn);
}

export function hasLocalMutation(fn: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOCAL_MUTATIONS, fn);
}

function asArgs(args: unknown): Record<string, unknown> {
  return args !== null && typeof args === "object" ? (args as Record<string, unknown>) : {};
}

export function runLocalQuery(fn: string, args: unknown): unknown {
  const vault = requireActiveVault();
  const handler = LOCAL_QUERIES[fn];
  if (!handler) throw new Error(`No local query registered for ${fn}`);
  return handler({ db: vault.reader(), userId: vault.subject, now: Date.now() }, asArgs(args));
}

const writeErrorListeners = new Set<(error: VaultWriteError) => void>();

/** Subscribe to failed local writes (the app shows one alert; the caller's draft stays intact). */
export function onVaultWriteError(listener: (error: VaultWriteError) => void): () => void {
  writeErrorListeners.add(listener);
  return () => {
    writeErrorListeners.delete(listener);
  };
}

function createdId(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (result !== null && typeof result === "object" && "_id" in result) {
    const id = (result as { _id: unknown })._id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

/**
 * Run a personal-data command against the vault. Resolves only after the change (and, for paid
 * vaults, its replication intent) is durably committed; rejects with the handler's own error for
 * invalid input, or with `VaultWriteError` when the device could not persist it. Never resolves a
 * placeholder for an unsaved write.
 */
export function runLocalMutation(
  fn: string,
  rawArgs: unknown,
  expectedVault: VaultStore | null = getActiveVault()
): unknown {
  const vault = requireActiveVault(expectedVault);
  const handler = LOCAL_MUTATIONS[fn];
  if (!handler) throw new Error(`No local mutation registered for ${fn}`);
  const args = asArgs(rawArgs);
  const replicate = isReplicationEnabled() && !DEVICE_LOCAL_MUTATIONS.has(fn);
  try {
    const result = vault.commit(
      (db) => handler({ db, userId: vault.subject, now: Date.now() }, args),
      replicate
        ? (res) => ({
            fn,
            args: toPortableImageRefs(args),
            idempotencyKey: newIdempotencyKey(),
            clientId: isCreateMutation(fn) ? createdId(res) : undefined,
          })
        : undefined
    );
    if (replicate) requestReplication();
    return result;
  } catch (error) {
    if (error instanceof VaultWriteError) {
      for (const listener of writeErrorListeners) listener(error);
    }
    throw error;
  }
}
