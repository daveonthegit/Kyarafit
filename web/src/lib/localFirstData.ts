/**
 * Read every local-first collection from the offline runtime's local store (DATA_AND_SYNC.md §11).
 *
 * Data export must include a FREE user's locally-created rows, which never reach Convex (REQ-D100
 * "export is free"; invariant #2 "UI reads/writes only through the offline bridge for local-first
 * data"). Sourcing the export from the local store — rather than `sync.listChangedSince` (cloud) —
 * makes it non-empty for a free user with no cloud data. The portable collection keys match the
 * runtime's entity-row table names exactly, so each maps 1:1.
 *
 * Not Offline Core (it composes the runtime + the pure portability helpers), so it is free to import
 * both `@/lib/offline` and `./dataPortability`.
 */
import { offlineRuntime } from "@/lib/offline";
import {
  emptyCollections,
  PORTABLE_COLLECTIONS,
  toExportableRows,
  type PortableCollections,
} from "./dataPortability";

/** Snapshot all portable collections from the local store (synced base + pending overlays). */
export function readLocalCollections(): PortableCollections {
  const collections = emptyCollections();
  for (const key of PORTABLE_COLLECTIONS) {
    collections[key] = toExportableRows(offlineRuntime.listLocalEntityRowsSync(key));
  }
  return collections;
}
