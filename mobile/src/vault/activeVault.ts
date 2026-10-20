import * as FileSystem from "expo-file-system/legacy";
import {
  closeVaultDatabase,
  openVaultDatabase,
  vaultKeyForSubject,
  VaultLockedError,
} from "@/offline/db";
import { newClientId } from "@/offline/clientId";
import {
  clearActiveAccount,
  loadActiveAccount,
  saveActiveAccount,
  type VaultAccount,
} from "./account";
import { vaultImageCodec, vaultImageDir } from "./images";
import { recordPublicationRemovals } from "./publicationRemovals";
import { Replicator } from "./replica/replicator";
import { VaultStore, type VaultSql } from "./store";

/**
 * Lifecycle of the one unlocked vault.
 *
 * - `booting`  — reading the persisted active account at launch.
 * - `locked`   — nobody is signed in on this device; personal data stays on disk, untouched.
 * - `unlocked` — `account`'s vault is open; the planner works with or without a network.
 * - `error`    — the vault exists but could not be opened (disk/corruption). Shown, never wiped.
 */
export type VaultState =
  | { status: "booting" }
  | { status: "locked" }
  | { status: "unlocked"; account: VaultAccount }
  | { status: "error"; account: VaultAccount; message: string };

let state: VaultState = { status: "booting" };
let store: VaultStore | null = null;
let replicator: Replicator | null = null;
let vaultSql: VaultSql | null = null;
let storeUnsubscribe: (() => void) | null = null;
let dataVersion = 0;
const listeners = new Set<() => void>();

function notify(): void {
  dataVersion += 1;
  for (const listener of listeners) listener();
}

function setState(next: VaultState): void {
  state = next;
  notify();
}

/** Subscribe to lock/unlock AND to every committed vault write (for `useSyncExternalStore`). */
export function subscribeVault(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Monotonic snapshot that changes whenever vault state or vault data changes. */
export function getVaultDataVersion(): number {
  return dataVersion;
}

export function getVaultState(): VaultState {
  return state;
}

export function getActiveVault(): VaultStore | null {
  return store;
}

/** The unlocked vault's managed-sync replicator (idle and disabled for free vaults). */
export function getActiveReplicator(): Replicator | null {
  return replicator;
}

/** The unlocked vault's database, for vault-scoped bookkeeping outside the store. */
export function getActiveVaultSql(): VaultSql | null {
  return vaultSql;
}

export function notifyVaultDataChanged(expectedSql: VaultSql): void {
  if (vaultSql === expectedSql) notify();
}

export function requireActiveVault(expected: VaultStore | null = store): VaultStore {
  if (store !== expected)
    throw new Error("The active account changed. Reopen this screen and try again.");
  if (!store) throw new VaultLockedError();
  return store;
}

/** Directory holding the unlocked vault's photos, or null when locked. */
export function activeVaultImageDir(): string | null {
  const docs = FileSystem.documentDirectory;
  if (!store || !docs) return null;
  return vaultImageDir(docs, vaultKeyForSubject(store.subject));
}

type OpenVault = { store: VaultStore; replicator: Replicator; sql: VaultSql };

function openStore(account: VaultAccount): OpenVault {
  const sql = openVaultDatabase(account.subject);
  const docs = FileSystem.documentDirectory ?? "";
  let opened: VaultStore | null = null;
  const sync = new Replicator(sql, {
    newOpId: newClientId,
    onRowsChanged: () => opened?.reloadFromDisk(),
  });
  const next = new VaultStore({
    subject: account.subject,
    sql,
    newId: newClientId,
    codec: vaultImageCodec(vaultImageDir(docs, vaultKeyForSubject(account.subject))),
    onPersist: (tx, changes) => {
      sync.recordChanges(tx, changes);
      recordPublicationRemovals(tx, changes);
    },
  });
  opened = next;
  if (next.corruptRowCount > 0) {
    console.warn(`[vault] ${next.corruptRowCount} unreadable rows were left untouched on disk`);
  }
  return { store: next, replicator: sync, sql };
}

function attach(next: OpenVault | null): void {
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  replicator?.dispose();
  store = next?.store ?? null;
  replicator = next?.replicator ?? null;
  vaultSql = next?.sql ?? null;
  if (next) storeUnsubscribe = next.store.subscribe(notify);
}

/**
 * Lifecycle operations (unlock, boot, lock) run one at a time, in call order, and every new call
 * synchronously invalidates the ones still pending. A continuation that resumes after an await
 * re-checks its generation before touching the vault or the persisted account, so a slow profile
 * save can never re-open a vault that sign-out has locked, and a slow unlock of account A can never
 * land after a switch to account B.
 */
let lifecycleGeneration = 0;
let lifecycleQueue: Promise<void> = Promise.resolve();

function runLifecycle(task: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
  const generation = ++lifecycleGeneration;
  const isCurrent = () => generation === lifecycleGeneration;
  const run = lifecycleQueue.then(() => (isCurrent() ? task(isCurrent) : undefined));
  lifecycleQueue = run.catch(() => {});
  return run;
}

function openAndPublish(account: VaultAccount): void {
  try {
    attach(openStore(account));
    setState({ status: "unlocked", account });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[vault] could not open the local vault", error);
    setState({ status: "error", account, message });
  }
}

/**
 * Open `account`'s vault and make it the active one. Opening the same account again only refreshes
 * the stored profile. Switching accounts closes (never deletes) the previous vault first.
 */
export function unlockVault(account: VaultAccount): Promise<void> {
  return runLifecycle(async (isCurrent) => {
    try {
      await saveActiveAccount(account);
    } catch (error) {
      if (!isCurrent()) return;
      attach(null);
      closeVaultDatabase();
      const message = error instanceof Error ? error.message : String(error);
      console.error("[vault] could not persist the active account", error);
      setState({ status: "error", account, message });
      return;
    }
    if (!isCurrent()) return;
    if (store && store.subject === account.subject) {
      setState({ status: "unlocked", account });
      return;
    }
    attach(null);
    closeVaultDatabase();
    openAndPublish(account);
  });
}

/** Launch: reopen the last signed-in account's vault without touching the network. */
export function bootVault(): Promise<void> {
  return runLifecycle(async (isCurrent) => {
    const account = await loadActiveAccount();
    if (!isCurrent()) return;
    if (!account) {
      setState({ status: "locked" });
      return;
    }
    openAndPublish(account);
  });
}

/**
 * Sign-out: close the vault immediately (pending unlocks are invalidated) and forget which account
 * is active. The data stays on the device.
 */
export function lockVault(): Promise<void> {
  const generation = ++lifecycleGeneration;
  attach(null);
  closeVaultDatabase();
  setState({ status: "locked" });
  // Serialized after any in-flight profile save, so a stale save can never outlive this clear.
  const run = lifecycleQueue.then(async () => {
    await clearActiveAccount();
    if (generation === lifecycleGeneration && state.status !== "locked")
      setState({ status: "locked" });
  });
  lifecycleQueue = run.catch(() => {});
  return run;
}

/** Test seam: install a store directly (no SQLite file / AsyncStorage). */
export function __setActiveVaultForTests(
  next: VaultStore | null,
  account?: VaultAccount,
  extra?: { replicator?: Replicator; sql?: VaultSql }
): void {
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  replicator?.dispose();
  store = next;
  replicator = extra?.replicator ?? null;
  vaultSql = extra?.sql ?? null;
  if (next) storeUnsubscribe = next.subscribe(notify);
  state = next
    ? { status: "unlocked", account: account ?? { subject: next.subject, lastVerifiedAt: 0 } }
    : { status: "locked" };
  notify();
}
