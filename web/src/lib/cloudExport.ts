/**
 * Server half of the web data export (ADR-0006): web edits save straight to Convex and are no
 * longer pulled into the browser's local store, so an export must read the signed-in account's
 * rows from the server and merge them with whatever the local store still retains.
 *
 * Uses existing owner-scoped queries only. Account-wide lists run once; anything per build or per
 * convention runs as its own query, a few at a time, so no single query reads the whole account's
 * workflow once per build:
 * - builds: `builds.list`
 * - conventions: `conventions.list`; packingListItems: `conventions.getPacking` per convention
 * - cosplayNodes: `cosplayNodes.list`
 * - workflowItems: `workflow.listBuildTree` per build (full rows with their attachment rows), plus
 *   `workflow.listPlanner` for every other task. The planner returns a projection, so tasks reachable
 *   only through it lose notes, reminders and attachment roles, and group rows outside any build
 *   are not exported.
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
  /** Most per-build / per-convention queries in flight at once. */
  concurrency?: number;
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
const WORKFLOW_TREE_FIELDS = [
  "children",
  "dependencies",
  "blockedByCount",
  "isBlocked",
  "progressPercent",
  "childCount",
];
const PLANNER_DERIVED_FIELDS = [
  "progressPercent",
  "overdue",
  "blockedByCount",
  "blockedByTitles",
  "buildName",
  "conventionName",
];
/** Planner projection field → workflow attachment `entityType`. */
const PLANNER_LINKS = [
  ["buildId", "build"],
  ["conventionId", "convention"],
  ["cosplayNodeId", "cosplayNode"],
  ["packingListItemId", "packingItem"],
] as const;

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

/** Depth-first rows of a workflow tree (`listBuildTree` nests children inside each node). */
function flattenTree(nodes: unknown): Row[] {
  return records(nodes).flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** A planner-only task: keep stored fields and turn its linked ids into minimal attachments. */
function fromPlannerRow(row: Row): Row {
  const attachments = PLANNER_LINKS.flatMap(([field, entityType]) =>
    typeof row[field] === "string" ? [{ entityType, entityId: row[field] }] : []
  );
  return {
    ...omit(row, [...PLANNER_DERIVED_FIELDS, ...PLANNER_LINKS.map(([field]) => field)]),
    attachments,
  };
}

/**
 * Run `tasks` with at most `limit` in flight. Rejects with the first failure and starts no new
 * task after it.
 */
async function runBounded(
  tasks: ReadonlyArray<() => Promise<void>>,
  limit: number,
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
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), tasks.length) }, worker));
}

/** Fetch every portable collection the signed-in account holds on the server. Rejects on failure. */
export async function fetchCloudCollections(
  client: CloudExportClient,
  { concurrency = CLOUD_EXPORT_CONCURRENCY, onProgress }: CloudExportOptions = {}
): Promise<PortableCollections> {
  const [builds, conventions, nodes, planner] = await Promise.all([
    client.query(api.builds.list, {}),
    client.query(api.conventions.list, {}),
    client.query(api.cosplayNodes.list, {}),
    client.query(api.workflow.listPlanner, {}),
  ]);
  const buildRows = records(builds);
  const conventionRows = records(conventions);

  // Per-build trees and per-convention packing lists, a few queries at a time.
  const trees = new Map<string, Row[]>();
  const packing = new Map<string, Row[]>();
  const perRow: Array<() => Promise<void>> = [
    ...buildRows.flatMap((build) => {
      const id = rowId(build);
      return id
        ? [
            async () => {
              const tree = await client.query(api.workflow.listBuildTree, {
                buildId: id as Id<"builds">,
              });
              trees.set(id, flattenTree(isRecord(tree) ? tree.items : undefined));
            },
          ]
        : [];
    }),
    ...conventionRows.flatMap((convention) => {
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
    }),
  ];
  let done = 0;
  onProgress?.(done, perRow.length);
  await runBounded(perRow, concurrency, () => onProgress?.(++done, perRow.length));

  // A shared element's tasks appear under every build that uses it: keep the first copy.
  const workflow = new Map<string, Row>();
  for (const build of buildRows) {
    for (const item of trees.get(rowId(build) ?? "") ?? []) {
      const id = rowId(item);
      if (id && !workflow.has(id)) workflow.set(id, omit(item, WORKFLOW_TREE_FIELDS));
    }
  }
  for (const item of records(planner)) {
    const id = rowId(item);
    if (id && !workflow.has(id)) workflow.set(id, fromPlannerRow(item));
  }

  return {
    builds: toExportableRows(buildRows.map((row) => omit(row, BUILD_DERIVED_FIELDS))),
    conventions: toExportableRows(conventionRows),
    packingListItems: toExportableRows(
      conventionRows.flatMap((row) => packing.get(rowId(row) ?? "") ?? [])
    ),
    cosplayNodes: toExportableRows(records(nodes).map((row) => omit(row, NODE_DERIVED_FIELDS))),
    workflowItems: toExportableRows([...workflow.values()]),
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
