import type { ConvexReactClient } from "convex/react";
import { api } from "convex/_generated/api";
import type { ExportableRow } from "@kyarafit/design-system/domain/importExport";
import {
  emptyCollections,
  PORTABLE_COLLECTIONS,
  toExportableRows,
  type PortableCollections,
} from "./dataPortability";

export type CloudExportClient = Pick<ConvexReactClient, "query">;

export interface CloudExportOptions {
  onProgress?: (done: number, total: number) => void;
}

export const CLOUD_EXPORT_CONCURRENCY = 6;

export async function fetchCloudCollections(
  client: CloudExportClient,
  { onProgress }: CloudExportOptions = {}
): Promise<PortableCollections> {
  const collections = emptyCollections();
  let next = 0;
  let done = 0;
  let failed = false;
  onProgress?.(done, PORTABLE_COLLECTIONS.length);
  const worker = async () => {
    while (!failed && next < PORTABLE_COLLECTIONS.length) {
      const collection = PORTABLE_COLLECTIONS[next++];
      try {
        collections[collection] = toExportableRows(
          await client.query(api.accountExport.listCollection, { collection })
        );
      } catch (error) {
        failed = true;
        throw error;
      }
      onProgress?.(++done, PORTABLE_COLLECTIONS.length);
    }
  };
  await Promise.all(Array.from({ length: CLOUD_EXPORT_CONCURRENCY }, worker));
  return collections;
}

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
