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
import { VaultStore } from "./store";

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

function openStore(account: VaultAccount): VaultStore {
  const sql = openVaultDatabase(account.subject);
  const docs = FileSystem.documentDirectory ?? "";
  const next = new VaultStore({
    subject: account.subject,
    sql,
    newId: newClientId,
    codec: vaultImageCodec(vaultImageDir(docs, vaultKeyForSubject(account.subject))),
  });
  if (next.corruptRowCount > 0) {
    console.warn(`[vault] ${next.corruptRowCount} unreadable rows were left untouched on disk`);
  }
  return next;
}

function attach(next: VaultStore | null): void {
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  store = next;
  if (next) storeUnsubscribe = next.subscribe(notify);
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
    await saveActiveAccount(account);
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
export function __setActiveVaultForTests(next: VaultStore | null, account?: VaultAccount): void {
  attach(next);
  state = next
    ? { status: "unlocked", account: account ?? { subject: next.subject, lastVerifiedAt: 0 } }
    : { status: "locked" };
  notify();
}
