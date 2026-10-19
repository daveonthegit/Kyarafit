import { PORTABLE_COLLECTIONS, type PortableCollectionKey } from "./dataPortability";
import { newIdempotencyKey } from "./offline/idempotencyKey";
import { offlineRuntime } from "./offline/runtime";
import { RESTORE_SESSION_KEY } from "./offline/restoreState";

/**
 * One restore attempt. Every row the attempt creates is recorded here (in the signed-in account's
 * local store) as soon as its create returns. A crash between server commit and recording can
 * leave an unrecorded row; see DATA_AND_SYNC.md §11 for Undo's limitations.
 * Interrupted restores are never resumed: the user undoes the session and restores again.
 */
export interface RestoreSessionRecord {
  id: string;
  created: { collection: PortableCollectionKey; id: string }[];
}

export class IncompleteRestoreError extends Error {
  constructor() {
    super("A previous restore did not finish");
    this.name = "IncompleteRestoreError";
  }
}

export class RestoreBusyError extends Error {
  constructor() {
    super("Restore in progress in another tab");
    this.name = "RestoreBusyError";
  }
}

export const restoreLockName = (subject: string): string => `kyarafit-restore:${subject}`;

export async function withRestoreLock<T>(subject: string, operation: () => Promise<T>): Promise<T> {
  const check = guard(subject);
  check();
  try {
    if (typeof navigator === "undefined" || !navigator.locks) return await operation();
    return await navigator.locks.request(
      restoreLockName(subject),
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) throw new RestoreBusyError();
        check();
        offlineRuntime.notifyRestoreChange();
        return operation();
      }
    );
  } finally {
    if (offlineRuntime.getSubject() === subject) offlineRuntime.notifyRestoreChange();
  }
}

function guard(subject: string): () => void {
  const assertCurrent = offlineRuntime.sessionGuard();
  return () => {
    assertCurrent();
    if (offlineRuntime.getSubject() !== subject) throw new Error("Local account changed");
  };
}

function parseRecord(raw: string | null): RestoreSessionRecord | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as RestoreSessionRecord;
  if (
    typeof value?.id !== "string" ||
    !Array.isArray(value.created) ||
    !value.created.every(
      (entry) =>
        PORTABLE_COLLECTIONS.includes(entry?.collection) &&
        typeof entry.id === "string" &&
        entry.id.length > 0
    )
  ) {
    throw new Error("Invalid restore session");
  }
  return value;
}

/** The account's unfinished restore session, or null when none is pending. */
export async function readRestoreSession(subject: string): Promise<RestoreSessionRecord | null> {
  const check = guard(subject);
  check();
  const raw = await offlineRuntime.getStore().getMeta(RESTORE_SESSION_KEY);
  check();
  return parseRecord(raw);
}

async function save(
  subject: string,
  record: RestoreSessionRecord | null,
  expectedId: string | null
): Promise<void> {
  const check = guard(subject);
  check();
  const current = await readRestoreSession(subject);
  check();
  if ((current?.id ?? null) !== expectedId) throw new IncompleteRestoreError();
  await offlineRuntime.setMeta(RESTORE_SESSION_KEY, record ? JSON.stringify(record) : "");
  check();
}

export interface RestoreSession {
  readonly id: string;
  start(): Promise<void>;
  /** Durably record a row this restore created. */
  record(collection: PortableCollectionKey, id: string): Promise<void>;
  /** Mark the restore finished: its rows are kept and the session is cleared. */
  complete(): Promise<void>;
}

export function createRestoreSession(subject: string): RestoreSession {
  const record: RestoreSessionRecord = { id: newIdempotencyKey(), created: [] };
  return {
    id: record.id,
    async start() {
      await save(subject, record, null);
    },
    async record(collection, id) {
      if (record.created.some((entry) => entry.collection === collection && entry.id === id))
        return;
      record.created.push({ collection, id });
      await save(subject, record, record.id);
    },
    async complete() {
      await save(subject, null, record.id);
    },
  };
}

/** Children before parents: tasks, packing, elements (newest first), builds, conventions. */
const UNDO_ORDER: PortableCollectionKey[] = [
  "workflowItems",
  "packingListItems",
  "cosplayNodes",
  "builds",
  "conventions",
];

export interface UndoRestoreArgs {
  subject: string;
  /** Delete one server row; resolve when it is gone (already-deleted rows must resolve too). */
  deleteRow(collection: PortableCollectionKey, id: string): Promise<void>;
}

/**
 * Undo the account's unfinished restore by deleting recorded rows (server and local) and clearing
 * the session. Existing server deletes can cascade; see DATA_AND_SYNC.md §11 for isolation limits.
 * Progress is saved after each deletion, so a failed undo can be retried.
 */
export async function undoRestoreSession({ subject, deleteRow }: UndoRestoreArgs): Promise<void> {
  await withRestoreLock(subject, async () => {
    const session = await readRestoreSession(subject);
    if (!session) return;
    const check = guard(subject);
    const remaining = [...session.created];
    const remove = async (collection: PortableCollectionKey, id: string) => {
      check();
      await deleteRow(collection, id);
      check();
      await offlineRuntime.removeImportedEntityRow(collection, id);
    };
    for (const collection of UNDO_ORDER) {
      const entries = [...remaining].reverse().filter((entry) => entry.collection === collection);
      for (const entry of entries) {
        await remove(collection, entry.id);
        remaining.splice(remaining.indexOf(entry), 1);
        await save(subject, { ...session, created: remaining }, session.id);
      }
    }
    await save(subject, null, session.id);
  });
}
