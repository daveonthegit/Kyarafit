/**
 * Data export / import orchestration (PRODUCT_SPEC.md §4.9 REQ-012/095/096, DATA_AND_SYNC.md §11
 * REQ-D100/101/102). Pure, dependency-free, and unit-testable: it takes already-gathered query
 * results plus an injected `createRow` callback so it can be exercised without a live Convex.
 *
 * Export and import are FREE for everyone — there is intentionally no tier gate in this module.
 *
 * Round-trip fidelity (REQ-D102): each collection is serialized with the shared `exportBundle` and
 * read back with `importBundle`, so a bundle exported on one device reproduces faithfully on another.
 */
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptionalUrl,
  validateDateString,
} from "../../../convex/lib/validation";
import {
  exportBundle,
  importBundle,
  EXPORT_BUNDLE_VERSION,
  type ExportableRow,
} from "@kyarafit/design-system/domain/importExport";

/** Local-first entity collections included in a portable bundle. Order is stable for summaries. */
export const PORTABLE_COLLECTIONS = [
  "builds",
  "conventions",
  "cosplayNodes",
  "packingListItems",
  "workflowItems",
] as const;

export type PortableCollectionKey = (typeof PORTABLE_COLLECTIONS)[number];

export type PortableCollections = Record<PortableCollectionKey, ExportableRow[]>;

/** Wrapper-bundle version (independent of the per-collection `EXPORT_BUNDLE_VERSION`). */
export const DATA_BUNDLE_VERSION = 1;

export interface DataBundle {
  /** Wrapper schema version. */
  version: number;
  /** Per-collection bundle version (from the shared exportBundle contract). */
  bundleVersion: number;
  /** ISO timestamp the bundle was produced. */
  exportedAt: string;
  /** One serialized `exportBundle` string per collection. */
  collections: Record<PortableCollectionKey, string>;
}

/** Thrown when an imported file is not a readable Kyarafit data bundle. Carries a friendly message. */
export class MalformedBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedBundleError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An empty set of collections — used as the loading/signed-out default and the import accumulator. */
export function emptyCollections(): PortableCollections {
  return {
    builds: [],
    conventions: [],
    cosplayNodes: [],
    workflowItems: [],
    packingListItems: [],
  };
}

/**
 * Convert Convex documents (keyed by `_id`) into `ExportableRow`s (keyed by `id`), preserving every
 * other field for round-trip fidelity. Rows that already carry a string `id` are passed through.
 */
export function toExportableRows(docs: ReadonlyArray<unknown>): ExportableRow[] {
  return docs.map((doc) => {
    if (!isRecord(doc)) {
      throw new Error("Cannot export a non-object row.");
    }
    const id = typeof doc.id === "string" ? doc.id : doc._id;
    if (typeof id !== "string") {
      throw new Error("Row is missing a string id and cannot be exported.");
    }
    return { ...doc, id };
  });
}

/** Serialize all collections into a single portable bundle string (REQ-D102). */
export function buildDataBundle(
  collections: PortableCollections,
  exportedAt: number = Date.now()
): string {
  const serialized = {} as Record<PortableCollectionKey, string>;
  for (const key of PORTABLE_COLLECTIONS) {
    serialized[key] = exportBundle(collections[key] ?? []);
  }
  const bundle: DataBundle = {
    version: DATA_BUNDLE_VERSION,
    bundleVersion: EXPORT_BUNDLE_VERSION,
    exportedAt: new Date(exportedAt).toISOString(),
    collections: serialized,
  };
  return JSON.stringify(bundle, null, 2);
}

/** Total number of rows across all collections (for an "export N items" affordance). */
export function countRows(collections: PortableCollections): number {
  return PORTABLE_COLLECTIONS.reduce((sum, key) => sum + (collections[key]?.length ?? 0), 0);
}

/**
 * Parse a bundle string back into collections. Throws `MalformedBundleError` (never crashes) for
 * non-JSON, non-bundle, or structurally-invalid input so the UI can show a clear error.
 */
export function parseDataBundle(serialized: string): PortableCollections {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new MalformedBundleError("This file isn't valid JSON, so it can't be imported.");
  }
  if (!isRecord(parsed) || !isRecord(parsed.collections)) {
    throw new MalformedBundleError("This file isn't a Kyarafit data export.");
  }
  if (parsed.version !== DATA_BUNDLE_VERSION || parsed.bundleVersion !== EXPORT_BUNDLE_VERSION) {
    throw new MalformedBundleError("This export version is not supported.");
  }
  const rawCollections = parsed.collections;
  const result = emptyCollections();
  for (const key of PORTABLE_COLLECTIONS) {
    const raw = rawCollections[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    let rows: ExportableRow[];
    try {
      rows = importBundle(raw);
    } catch {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    if (!Array.isArray(rows) || !rows.every((row) => isRecord(row) && typeof row.id === "string")) {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    result[key] = rows;
  }
  return result;
}

export interface CollectionImportResult {
  added: number;
  skipped: number;
}

export type ImportSummary = Record<PortableCollectionKey, CollectionImportResult>;

export interface ImportTotals {
  added: number;
  skipped: number;
}

/** Persist one new row for a collection (e.g. a Convex create mutation). Injected for testability. */
export type CreateRowFn = (
  collection: PortableCollectionKey,
  row: ExportableRow,
  existingId?: string
) => Promise<unknown> | unknown;

export interface ImportIdentity {
  id: string;
  complete: boolean;
  row: ExportableRow;
}

export class NonEmptyVaultError extends Error {
  constructor() {
    super("Restore requires an empty vault");
    this.name = "NonEmptyVaultError";
  }
}

export interface ImportIdentityStore {
  begin(imported: PortableCollections, existing: PortableCollections): Promise<void>;
  finish(): Promise<void>;
  key(collection: PortableCollectionKey, sourceId: string): string;
  read(collection: PortableCollectionKey, sourceId: string): Promise<ImportIdentity | null>;
  write(collection: PortableCollectionKey, sourceId: string, identity: ImportIdentity): Promise<void>;
}

export interface RunImportArgs {
  imported: PortableCollections;
  existing: PortableCollections;
  createRow: CreateRowFn;
  identities?: ImportIdentityStore;
  generatedWorkflow?: (nodeId: string, buildId?: string) => Promise<ExportableRow[]>;
}

const RELATION_FIELDS = {
  conventionId: "conventions",
  buildId: "builds",
  parentId: "workflowItems",
  parentNodeId: "cosplayNodes",
  cosplayNodeId: "cosplayNodes",
} as const;

const ATTACHMENT_TARGETS: Record<string, PortableCollectionKey> = {
  build: "builds",
  convention: "conventions",
  cosplayNode: "cosplayNodes",
  packingItem: "packingListItems",
};

type ResolveImportId = (id: unknown, collection: PortableCollectionKey) => string | undefined;

function remapRow(
  row: ExportableRow,
  resolve: ResolveImportId,
  nodes: readonly ExportableRow[]
): ExportableRow {
  const restored = { ...row };
  for (const [field, collection] of Object.entries(RELATION_FIELDS)) {
    if (row[field] != null) restored[field] = resolve(row[field], collection);
  }
  if (row.attachments !== undefined) {
    if (!Array.isArray(row.attachments)) throw new MalformedBundleError("Invalid imported attachments");
    restored.attachments = row.attachments.map((value: unknown) => {
      if (
        !isRecord(value) ||
        typeof value.entityType !== "string" ||
        !Object.prototype.hasOwnProperty.call(ATTACHMENT_TARGETS, value.entityType) ||
        typeof value.entityId !== "string" ||
        !value.entityId ||
        (value.role !== undefined && typeof value.role !== "string")
      ) {
        throw new MalformedBundleError("Invalid imported attachment");
      }
      return {
        entityType: value.entityType,
        entityId: resolve(value.entityId, ATTACHMENT_TARGETS[value.entityType]),
        role: value.role,
        buildContextId: resolve(value.buildContextId, "builds"),
      };
    });
  }
  if (typeof row.dedupeKey === "string") {
    const key = row.dedupeKey;
    const prefix = /^autogen:(buy|wip):/.exec(key)?.[0];
    if (key.startsWith("packing:")) {
      restored.dedupeKey = `packing:${resolve(key.slice("packing:".length), "packingListItems")}`;
    } else if (prefix) {
      const targets = nodes.filter((node) => key.endsWith(`:${node.id}`));
      if (targets.length !== 1) throw new MalformedBundleError("Missing or ambiguous generated task element");
      const node = targets[0];
      const scope = key.slice(prefix.length, -`:${node.id}`.length);
      const restoredScope = scope === "shared" ? scope : resolve(scope, "builds");
      restored.dedupeKey = `${prefix}${restoredScope}:${resolve(node.id, "cosplayNodes")}`;
    }
  }
  return restored;
}

function validateRowFields(row: ExportableRow): void {
  const textLimits = {
    name: MAX_LENGTH.name,
    title: MAX_LENGTH.label,
    label: MAX_LENGTH.label,
    character: MAX_LENGTH.character,
    notes: MAX_LENGTH.notes,
    location: MAX_LENGTH.location,
    category: MAX_LENGTH.category,
    unit: MAX_LENGTH.category,
    buildInstructions: MAX_LENGTH.notes,
    dedupeKey: 500,
  };
  try {
    for (const [field, limit] of Object.entries(textLimits)) {
      const value = row[field];
      if (value == null) continue;
      if (typeof value !== "string") throw new Error(`Invalid imported ${field}`);
      sanitizeAndLimit(value, limit, field);
    }
    for (const field of ["date", "startDate", "endDate", "targetDate", "dueDate"]) {
      const value = row[field];
      if (value == null || value === "") continue;
      if (typeof value !== "string") throw new Error(`Invalid imported ${field}`);
      validateDateString(value, field);
    }
    if (row.tags != null) {
      if (!Array.isArray(row.tags)) throw new Error("Invalid imported element tags");
      for (const tag of row.tags) {
        if (typeof tag !== "string") throw new Error("Invalid imported element tag");
        sanitizeAndLimit(tag, MAX_LENGTH.tag, "Tag");
      }
    }
    if (row.sourceUrl != null) {
      if (typeof row.sourceUrl !== "string") throw new Error("Invalid imported source URL");
      sanitizeOptionalUrl(row.sourceUrl);
    }
    for (const field of [
      "budgetCents",
      "sortOrder",
      "priority",
      "directCostCents",
      "unitCostCents",
      "quantity",
    ]) {
      const value = row[field];
      if (value != null && (typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error(`Invalid imported ${field}`);
      }
    }
    if (row.consumable != null && typeof row.consumable !== "boolean") {
      throw new Error("Invalid imported consumable flag");
    }
  } catch (error) {
    throw new MalformedBundleError(error instanceof Error ? error.message : "Invalid imported row");
  }
}

function prepareImport(imported: PortableCollections): PortableCollections {
  const registry = new Map<string, { collection: PortableCollectionKey; row: ExportableRow }>();
  for (const collection of PORTABLE_COLLECTIONS) {
    if (!Array.isArray(imported[collection])) {
      throw new MalformedBundleError(`Invalid imported collection: ${collection}`);
    }
    for (const row of imported[collection]) {
      if (!isRecord(row) || typeof row.id !== "string" || !row.id) {
        throw new MalformedBundleError("Invalid imported row");
      }
      const previous = registry.get(row.id);
      if (previous && previous.collection !== collection) {
        throw new MalformedBundleError(`Ambiguous imported identity: ${row.id}`);
      }
      registry.set(row.id, { collection, row });
    }
    if (new Set(imported[collection].map((row) => row.id)).size !== imported[collection].length) {
      throw new MalformedBundleError(`Duplicate imported identity in ${collection}`);
    }
  }
  const generatedWorkflows = new Set<string>();
  for (const row of imported.packingListItems) {
    if (row.workflowItemId != null) {
      if (typeof row.workflowItemId !== "string" || !row.workflowItemId) {
        throw new MalformedBundleError("Invalid packing workflow identity");
      }
      if (generatedWorkflows.has(row.workflowItemId)) {
        throw new MalformedBundleError("Duplicate packing workflow identity");
      }
      generatedWorkflows.add(row.workflowItemId);
      const target = registry.get(row.workflowItemId);
      if (target && target.collection !== "workflowItems") {
        throw new MalformedBundleError("Invalid packing workflow identity");
      }
      if (!target) {
        registry.set(row.workflowItemId, {
          collection: "workflowItems",
          row: { id: row.workflowItemId },
        });
      }
    }
  }
  const resolve: ResolveImportId = (id, collection) => {
    if (id === undefined || id === null) return undefined;
    if (typeof id !== "string" || registry.get(id)?.collection !== collection) {
      throw new MalformedBundleError(`Missing imported relationship: ${String(id)}`);
    }
    return id;
  };
  for (const collection of PORTABLE_COLLECTIONS) {
    for (const row of imported[collection]) {
      validateRowFields(row);
      remapRow(row, resolve, imported.cosplayNodes);
      if (collection === "packingListItems" && !row.conventionId) {
        throw new MalformedBundleError("Packing item has no convention");
      }
      if (collection === "cosplayNodes") {
        if (row.nodeType !== "element" && row.nodeType !== "material") {
          throw new MalformedBundleError("Invalid element type");
        }
        if (
          row.parentNodeId &&
          registry.get(String(row.parentNodeId))?.row.nodeType === "material" &&
          row.nodeType !== "material"
        ) {
          throw new MalformedBundleError("Invalid element parent type");
        }
      }
    }
  }
  const plan = emptyCollections();
  for (const collection of PORTABLE_COLLECTIONS) {
    const available = new Set<string>();
    if (collection === "workflowItems") {
      for (const id of generatedWorkflows) {
        if (!imported.workflowItems.some((row) => row.id === id)) available.add(id);
      }
    }
    const pending = [...imported[collection]];
    while (pending.length) {
      const index = pending.findIndex((row) => {
        const parent = collection === "cosplayNodes" ? row.parentNodeId : row.parentId;
        return parent == null || available.has(String(parent));
      });
      if (index < 0) throw new MalformedBundleError("Missing or cyclic imported parent");
      const [row] = pending.splice(index, 1);
      plan[collection].push(row);
      available.add(row.id);
    }
  }
  return plan;
}

// Merge-restore into a non-empty vault is a possible later feature.
export async function runImport({
  imported,
  existing,
  createRow,
  identities,
  generatedWorkflow,
}: RunImportArgs): Promise<ImportSummary> {
  const plan = prepareImport(imported);
  if (identities) await identities.begin(imported, existing);
  else if (countRows(existing) > 0) throw new NonEmptyVaultError();
  const summary = {} as ImportSummary;
  const ids = new Map<string, string>();
  const completed = new Set<string>();
  for (const key of PORTABLE_COLLECTIONS) {
    for (const row of imported[key]) {
      const identity = await identities?.read(key, row.id);
      if (!identity) continue;
      ids.set(row.id, identity.id);
      if (identity.complete) completed.add(row.id);
      if (key === "packingListItems" && typeof row.workflowItemId === "string" &&
        typeof identity.row.workflowItemId === "string") {
        ids.set(row.workflowItemId, identity.row.workflowItemId);
      }
    }
  }
  const resolve = (id: unknown): string | undefined => {
    if (id === undefined || id === null) return undefined;
    if (typeof id !== "string" || !ids.has(id))
      throw new Error(`Missing imported relationship: ${String(id)}`);
    return ids.get(id);
  };
  for (const key of PORTABLE_COLLECTIONS) {
    if (key === "workflowItems" && generatedWorkflow) {
      for (const node of imported.cosplayNodes) {
        if (
          !plan.workflowItems.some((row) =>
            !ids.has(row.id) &&
            typeof row.dedupeKey === "string" &&
            /^autogen:(buy|wip):/.test(row.dedupeKey) &&
            row.dedupeKey.endsWith(`:${node.id}`)
          )
        ) {
          continue;
        }
        const nodeId = ids.get(node.id);
        if (!nodeId) continue;
        const buildId = typeof node.buildId === "string" ? ids.get(node.buildId) : undefined;
        const generated = await generatedWorkflow(nodeId, buildId);
        for (const task of generated) {
          if (typeof task.dedupeKey !== "string") continue;
          const operation = /^autogen:(buy|wip):/.exec(task.dedupeKey)?.[1];
          if (!operation || !task.dedupeKey.endsWith(`:${nodeId}`)) continue;
          const candidates = imported.workflowItems.filter(
            (row) =>
              typeof row.dedupeKey === "string" &&
              row.dedupeKey.startsWith(`autogen:${operation}:`) &&
              row.dedupeKey.endsWith(`:${node.id}`)
          );
          const source =
            candidates.find((row) => {
              const scope = String(row.dedupeKey).slice(
                `autogen:${operation}:`.length,
                -`:${node.id}`.length
              );
              return task.dedupeKey === `autogen:${operation}:${ids.get(scope) ?? scope}:${nodeId}`;
            }) ?? (candidates.length === 1 ? candidates[0] : undefined);
          if (source && !ids.has(source.id)) {
            ids.set(source.id, task.id);
            await identities?.write("workflowItems", source.id, {
              id: task.id,
              complete: false,
              row: source,
            });
          }
        }
      }
    }
    const importedRows = imported[key];
    let added = 0;
    for (const row of plan[key]) {
      if (completed.has(row.id)) continue;
      added += 1;
      const restored = remapRow(row, resolve, imported.cosplayNodes);
      const result = await createRow(key, restored, ids.get(row.id));
      const id =
        typeof result === "string"
          ? result
          : result && typeof result === "object" && "_id" in result
            ? result._id
            : undefined;
      if (typeof id !== "string") throw new Error("Import did not return a restored id");
      ids.set(row.id, id);
      let storedRow = restored;
      if (key === "packingListItems" && typeof row.workflowItemId === "string") {
        const workflowId =
          result && typeof result === "object" && "workflowItemId" in result
            ? result.workflowItemId
            : undefined;
        if (typeof workflowId !== "string")
          throw new Error("Packing restore did not return its workflow identity");
        ids.set(row.workflowItemId, workflowId);
        storedRow = { ...restored, workflowItemId: workflowId };
        await identities?.write("workflowItems", row.workflowItemId, {
          id: workflowId,
          complete: false,
          row: imported.workflowItems.find((task) => task.id === row.workflowItemId) ?? {
            id: row.workflowItemId,
          },
        });
      }
      await identities?.write(key, row.id, { id, complete: true, row: storedRow });
    }
    summary[key] = {
      added,
      skipped: importedRows.length - added,
    };
  }
  await identities?.finish();
  return summary;
}

/** Roll a per-collection summary up into overall added/skipped totals. */
export function summarizeTotals(summary: ImportSummary): ImportTotals {
  let added = 0;
  let skipped = 0;
  for (const key of PORTABLE_COLLECTIONS) {
    added += summary[key].added;
    skipped += summary[key].skipped;
  }
  return { added, skipped };
}
