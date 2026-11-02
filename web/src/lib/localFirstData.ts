/**
 * Read every local-first collection from the offline runtime's local store (DATA_AND_SYNC.md §11).
 *
 * Data export must include rows retained only in this browser (REQ-D100 "export is free";
 * invariant #2 "UI reads/writes only through the offline bridge for local-first data"). The export
 * merges these with the account's server rows (`cloudExport.ts`, ADR-0006) and uses them alone
 * while offline. The portable collection keys match the runtime's entity-row table names exactly,
 * so each maps 1:1.
 *
 * Not Offline Core (it composes the runtime + the pure portability helpers), so it is free to import
 * both `@/lib/offline` and `./dataPortability`.
 */
import { offlineRuntime } from "@/lib/offline";
import { portableRecord } from "../../../convex/lib/exportCollections";
import {
  emptyCollections,
  PORTABLE_COLLECTIONS,
  toExportableRows,
  type PortableCollections,
} from "./dataPortability";

/** Snapshot all portable collections from the local store (synced base + pending overlays). */
export function readLocalCollections(
  subject: string | null = offlineRuntime.getSubject()
): PortableCollections {
  const collections = emptyCollections();
  if (!subject || offlineRuntime.getSubject() !== subject) return collections;
  const rows = new Map(PORTABLE_COLLECTIONS.map((key) => [key, offlineRuntime.listLocalEntityRowsSync(key)]));
  const user = rows.get("users")?.find((row) => row.externalId === subject);
  const templates = new Set(rows.get("workflowTemplates")?.filter((row) => row.userId === subject).map((row) => row._id ?? row.id));
  const memberGroupIds = new Set(
    rows.get("groupMembers")?.filter((row) => row.userId === subject).map((row) => row.groupId)
  );
  const groups = new Set(
    rows.get("groups")
      ?.filter((row) => row.createdBy === subject && memberGroupIds.has(row._id ?? row.id))
      .map((row) => row._id ?? row.id)
  );
  for (const key of PORTABLE_COLLECTIONS) {
    const owned = (rows.get(key) ?? []).filter((row) => {
      if (key === "users") return row.externalId === subject;
      if (key === "groups") return groups.has(row._id ?? row.id);
      if (key === "follows") return row.followerId === subject;
      if (key === "workflowTemplateItems") return templates.has(row.templateId);
      if (key === "groupConventionDays") return groups.has(row.groupId);
      if (key === "broadcasts") return user != null && row.createdBy === (user._id ?? user.id);
      if (key === "userPushPreferences") return user != null && row.userId === (user._id ?? user.id);
      return row.userId === subject;
    });
    collections[key] = toExportableRows(owned.map((row) => portableRecord(key, row)));
  }
  const attachments = collections.workflowAttachments;
  collections.workflowItems = collections.workflowItems.map((row) => ({
    ...row,
    attachments: Array.isArray(row.attachments)
      ? row.attachments
      : attachments.filter((attachment) => attachment.workflowItemId === row.id),
  }));
  return collections;
}
