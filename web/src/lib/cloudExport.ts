/**
 * Server half of the web data export (ADR-0006): web edits save straight to Convex and are no
 * longer pulled into the browser's local store, so an export must read the signed-in account's
 * rows from the server and merge them with whatever the local store still retains.
 *
 * Fields the queries derive (progress, cost rollups, tree shape) are dropped so each row is the
 * stored record, and a build's `shareToken` is dropped because it is a live link credential.
 */
import type { ConvexReactClient } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { ExportableRow } from "@kyarafit/design-system/domain/importExport";
import {
  emptyCollections,
  PORTABLE_COLLECTIONS,
  toExportableRows,
  type PortableCollections,
} from "./dataPortability";

type Row = Record<string, unknown>;

export type CloudExportClient = Pick<ConvexReactClient, "query">;

export interface CloudExportOptions {
  /** Called as per-build / per-convention queries finish (`done` of `total`). */
  onProgress?: (done: number, total: number) => void;
}

export const CLOUD_EXPORT_CONCURRENCY = 6;

const BUILD_DERIVED_FIELDS = [
  "shareToken",
  "tasksTotal",
  "tasksChecked",
  "workflowProgressPercent",
  "packingProgressPercent",
  "nodeProgressPercent",
  "totalCostCents",
];
const NODE_DERIVED_FIELDS = [
  "overallBucket",
  "progressPercent",
  "totalCostCents",
  "childCount",
  "hasIncompleteDescendants",
];

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The records in a query result; anything that is not an array counts as no rows. */
function records(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function omit(row: Row, keys: readonly string[]): Row {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function rowId(row: Row): string | undefined {
  if (typeof row._id === "string") return row._id;
  return typeof row.id === "string" ? row.id : undefined;
}

/**
 * Run `tasks` with at most `limit` in flight. Rejects with the first failure and starts no new
 * task after it.
 */
async function runBounded(
  tasks: ReadonlyArray<() => Promise<void>>,
  onDone: () => void
): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
      } catch (error) {
        failed = true;
        throw error;
      }
      onDone();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CLOUD_EXPORT_CONCURRENCY, tasks.length) }, worker));
}

/** Fetch every portable collection the signed-in account holds on the server. Rejects on failure. */
export async function fetchCloudCollections(
  client: CloudExportClient,
  { onProgress }: CloudExportOptions = {}
): Promise<PortableCollections> {
  const [builds, conventions, nodes, workflow] = await Promise.all([
    client.query(api.builds.list, {}),
    client.query(api.conventions.list, {}),
    client.query(api.cosplayNodes.list, {}),
    client.query(api.workflow.listForExport, {}),
  ]);
  const buildRows = records(builds);
  const conventionRows = records(conventions);

  const packing = new Map<string, Row[]>();
  const perRow: Array<() => Promise<void>> = conventionRows.flatMap((convention) => {
    const id = rowId(convention);
    return id
      ? [
          async () => {
            const items = await client.query(api.conventions.getPacking, {
              conventionId: id as Id<"conventions">,
            });
            packing.set(id, records(items));
          },
        ]
      : [];
  });
  let done = 0;
  onProgress?.(done, perRow.length);
  await runBounded(perRow, () => onProgress?.(++done, perRow.length));

  return {
    builds: toExportableRows(buildRows.map((row) => omit(row, BUILD_DERIVED_FIELDS))),
    conventions: toExportableRows(conventionRows),
    packingListItems: toExportableRows(
      conventionRows.flatMap((row) => packing.get(rowId(row) ?? "") ?? [])
    ),
    cosplayNodes: toExportableRows(records(nodes).map((row) => omit(row, NODE_DERIVED_FIELDS))),
    workflowItems: toExportableRows(records(workflow)),
  };
}

/** Server rows plus local rows the server does not have; the server copy wins for a shared id. */
export function mergeCollections(
  server: PortableCollections,
  local: PortableCollections
): PortableCollections {
  const merged = emptyCollections();
  for (const key of PORTABLE_COLLECTIONS) {
    const serverRows: ExportableRow[] = server[key] ?? [];
    const serverIds = new Set(serverRows.map((row) => row.id));
    merged[key] = [...serverRows, ...(local[key] ?? []).filter((row) => !serverIds.has(row.id))];
  }
  return merged;
}
