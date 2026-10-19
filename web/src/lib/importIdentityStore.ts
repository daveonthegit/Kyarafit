import {
  NonEmptyVaultError,
  MalformedBundleError,
  emptyCollections,
  PORTABLE_COLLECTIONS,
  type ImportIdentity,
  type ImportIdentityStore,
  type PortableCollectionKey,
} from "./dataPortability";
import { rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { importKey } from "./importKey";
import { newIdempotencyKey } from "./offline/idempotencyKey";
import { offlineRuntime } from "./offline/runtime";

interface RestoreLedger {
  backup: string;
  attempt: string;
  complete: boolean;
  entries: Record<string, ImportIdentity>;
}

export function createImportIdentityStore(subject: string): ImportIdentityStore {
  const store = offlineRuntime.getStore();
  const assertCurrent = offlineRuntime.sessionGuard();
  const ledgerKey = "restore:active:v1";
  let ledger: RestoreLedger | undefined;
  const entryKey = (collection: string, sourceId: string) => JSON.stringify([collection, sourceId]);
  const check = () => {
    assertCurrent();
    if (offlineRuntime.getSubject() !== subject) throw new Error("Local account changed");
  };
  const current = () => {
    check();
    if (!ledger || ledger.complete) throw new Error("No active restore attempt");
    return ledger;
  };
  const save = async () => {
    check();
    await store.setMeta(ledgerKey, JSON.stringify(ledger));
    check();
  };
  const normalize = async (identity: ImportIdentity): Promise<ImportIdentity> => {
    const map = await store.loadIdMap();
    check();
    const normalized = rewriteIdsDeep(identity, map);
    normalized.row.id = identity.row.id;
    return normalized;
  };
  return {
    async begin(imported, existing) {
      check();
      const raw = await store.getMeta(ledgerKey);
      check();
      const previous = raw ? (JSON.parse(raw) as RestoreLedger) : undefined;
      const data = emptyCollections();
      for (const key of PORTABLE_COLLECTIONS) data[key] = [...existing[key]];
      const rows = await store.listEntityRows();
      check();
      for (const row of rows) {
        if (
          row.userId !== subject || row.deleted ||
          !PORTABLE_COLLECTIONS.includes(row.table as PortableCollectionKey)
        ) continue;
        const key = row.table as PortableCollectionKey;
        data[key] = data[key].filter((value) => value.id !== row.id);
        data[key].push({ ...JSON.parse(row.json), id: row.id });
      }
      const backup = JSON.stringify(imported);
      if (
        previous &&
        (typeof previous.backup !== "string" || typeof previous.attempt !== "string" ||
          typeof previous.complete !== "boolean" || !previous.entries)
      ) {
        throw new Error("Invalid restore ledger");
      }
      const resume = previous && !previous.complete && previous.backup === backup;
      if (previous && !previous.complete && !resume && Object.keys(previous.entries).length > 0) {
        throw new NonEmptyVaultError();
      }
      const owned = new Set<string>();
      const nodes = new Set<string>();
      if (resume) {
        for (const [key, entry] of Object.entries(previous.entries)) {
          const normalized = await normalize(entry);
          owned.add(normalized.id);
          if (JSON.parse(key)[0] === "cosplayNodes") nodes.add(normalized.id);
          if (typeof normalized.row.workflowItemId === "string") {
            owned.add(normalized.row.workflowItemId);
          }
        }
      }
      const map = await store.loadIdMap();
      check();
      if (resume) {
        for (const [key, entry] of Object.entries(previous.entries)) {
          const collection = JSON.parse(key)[0] as PortableCollectionKey;
          const normalized = await normalize(entry);
          const present = data[collection].find(
            (row) => rewriteIdsDeep(row.id, map) === normalized.id
          );
          if (
            entry.complete && !rows.some((row) =>
              row.table === collection && row.userId === subject && !row.deleted &&
              rewriteIdsDeep(row.id, map) === normalized.id
            )
          ) {
            throw new MalformedBundleError(
              "Previously restored data is missing. This restore cannot resume."
            );
          }
          if (
            collection === "cosplayNodes" && present &&
            present.nodeType !== normalized.row.nodeType
          ) {
            throw new NonEmptyVaultError();
          }
        }
      }
      for (const collection of PORTABLE_COLLECTIONS) {
        if (data[collection].some((row) => {
          if (owned.has(rewriteIdsDeep(row.id, map))) return false;
          return !(
            collection === "workflowItems" && row.sourceKind === "automation" &&
            typeof row.dedupeKey === "string" && /^autogen:(buy|wip):/.test(row.dedupeKey) &&
            [...nodes].some((id) => String(row.dedupeKey).endsWith(`:${id}`))
          );
        })) {
          throw new NonEmptyVaultError();
        }
      }
      ledger = resume ? previous : {
        backup, attempt: newIdempotencyKey(), complete: false, entries: {},
      };
      await save();
    },
    async finish() {
      current().complete = true;
      await save();
    },
    key(collection, sourceId) {
      return `${importKey(subject, collection, { id: sourceId })}:${current().attempt}`;
    },
    async read(collection, sourceId) {
      const value = current().entries[entryKey(collection, sourceId)];
      if (!value) return null;
      if (
        typeof value.id !== "string" || !value.id || typeof value.complete !== "boolean" ||
        !value.row || value.row.id !== sourceId
      ) {
        throw new Error("Invalid saved import identity");
      }
      return normalize(value);
    },
    async write(collection, sourceId, identity) {
      const active = current();
      const key = entryKey(collection, sourceId);
      const normalized = await normalize(identity);
      active.entries[key] = { ...normalized, complete: false };
      await save();
      if (identity.complete || collection === "cosplayNodes") {
        await offlineRuntime.writeImportedEntityRow({
          table: collection,
          id: normalized.id,
          userId: subject,
          json: JSON.stringify({
            ...normalized.row, id: normalized.id, _id: normalized.id, userId: subject,
          }),
          updatedAt: Date.now(),
          deleted: false,
          synced: !normalized.id.startsWith("local:"),
        });
      }
      active.entries[key] = normalized;
      await save();
    },
  };
}
