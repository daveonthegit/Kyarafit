import { getActiveVault, requireActiveVault } from "./activeVault";
import { VaultWriteError, type VaultStore } from "./store";
import { LOCAL_MUTATIONS, LOCAL_QUERIES } from "./handlers";

/**
 * The seam between screens and personal data.
 *
 * Screens still name a function (`api.builds.list`) because that is how the existing UI addresses
 * data, but for every personal-data function registered here the name is only a command key: the
 * local handler runs against the unlocked vault and NO Convex call is made — online or offline,
 * free or paid. Managed sync, when enabled, records the changed rows in its outbox inside the same
 * SQLite transaction (the vault's `onPersist` hook) and replicates them later.
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

/**
 * Run a personal-data command against the vault. Resolves only after the change (and, for paid
 * vaults, its sync outbox ops) is durably committed; rejects with the handler's own error for
 * invalid input, or with `VaultWriteError` when the device could not persist it. Never resolves a
 * placeholder for an unsaved write.
 */
export function runLocalMutation(
  fn: string,
  rawArgs: unknown,
  expectedVault: VaultStore | null = getActiveVault()
): unknown {
  return runLocalMutations([{ fn, args: asArgs(rawArgs) }], expectedVault)[0];
}

export type LocalMutationStep = {
  fn: string;
  args: Record<string, unknown> | ((results: readonly unknown[]) => Record<string, unknown>);
};

export function runLocalMutations(
  steps: readonly LocalMutationStep[],
  expectedVault: VaultStore | null = getActiveVault()
): unknown[] {
  const vault = requireActiveVault(expectedVault);
  try {
    return vault.commit((db) => {
      const results: unknown[] = [];
      for (const step of steps) {
        const handler = LOCAL_MUTATIONS[step.fn];
        if (!handler) throw new Error(`No local mutation registered for ${step.fn}`);
        const args = asArgs(typeof step.args === "function" ? step.args(results) : step.args);
        results.push(handler({ db, userId: vault.subject, now: Date.now() }, args));
      }
      return results;
    });
  } catch (error) {
    if (error instanceof VaultWriteError) {
      for (const listener of writeErrorListeners) listener(error);
    }
    throw error;
  }
}
