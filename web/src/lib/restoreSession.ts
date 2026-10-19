import { PORTABLE_COLLECTIONS, type PortableCollectionKey } from "./dataPortability";
import { newIdempotencyKey } from "./offline/idempotencyKey";
import { offlineRuntime } from "./offline/runtime";
import { RESTORE_SESSION_KEY } from "./offline/restoreState";

/**
 * One restore attempt. Every row the attempt creates is recorded here (in the signed-in account's
 * local store) as soon as its create returns, so an interrupted restore can be undone exactly.
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

async function save(subject: string, record: RestoreSessionRecord | null): Promise<void> {
  const check = guard(subject);
  check();
  await offlineRuntime.setMeta(RESTORE_SESSION_KEY, record ? JSON.stringify(record) : "");
  check();
}

export interface RestoreSession {
  readonly id: string;
  /** Durably record a row this restore created. The first record opens the session. */
  record(collection: PortableCollectionKey, id: string): Promise<void>;
  /** Mark the restore finished: its rows are kept and the session is cleared. */
  complete(): Promise<void>;
}

export function createRestoreSession(subject: string): RestoreSession {
  const record: RestoreSessionRecord = { id: newIdempotencyKey(), created: [] };
  return {
    id: record.id,
    async record(collection, id) {
      if (record.created.some((entry) => entry.collection === collection && entry.id === id))
        return;
      record.created.push({ collection, id });
      await save(subject, record);
    },
    async complete() {
      await save(subject, null);
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
 * Undo the account's unfinished restore: delete exactly the rows that session recorded (on the
 * server and in the local store) and clear it, returning the vault to the empty state the restore
 * started from. Progress is saved after each deletion, so a failed undo can be retried.
 */
export async function undoRestoreSession({
  subject,
  deleteRow,
}: UndoRestoreArgs): Promise<void> {
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
      await save(subject, { ...session, created: remaining });
    }
  }
  await save(subject, null);
}
