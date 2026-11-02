import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Spec: DATA_AND_SYNC.md §11 (REQ-D100 "export is free") + invariant #2 ("UI reads/writes only
// through the offline bridge for local-first data"). A FREE user has NO cloud data, so an export
// sourced from Convex (`sync.listChangedSince`) would be EMPTY. Sourcing it from the LOCAL STORE
// makes it non-empty.

const { client } = vi.hoisted(() => ({
  client: { mutation: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : undefined),
  useConvex: () => client,
}));

import { api } from "convex/_generated/api";
import { offlineRuntime } from "./offline/runtime";
import { InMemoryLocalStore } from "./offline/localStore";
import { setOfflineConnectivity } from "./offline/connectivity";
import { useOfflineMutation } from "./offline/useOfflineMutation";
import { readLocalCollections } from "./localFirstData";
import { rememberLocalAccount } from "./auth/localAccount";
import {
  buildDataBundle,
  countRows,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
} from "./dataPortability";
import { exportRecord } from "../test/accountExportRecords";

beforeEach(() => {
  vi.clearAllMocks();
  rememberLocalAccount("u1");
  offlineRuntime.setStore(new InMemoryLocalStore(), "u1");
});

afterEach(() => {
  setOfflineConnectivity(true);
});

describe("readLocalCollections (REQ-D100 — export is free)", () => {
  it.each(PORTABLE_COLLECTIONS)("round-trips locally retained %s records", (collection) => {
    for (const key of [
      "users",
      "groups",
      "groupMembers",
      "workflowTemplates",
      collection,
    ] as const) {
      offlineRuntime.upsertSyncedEntityRow(key, key, "u1", exportRecord(key));
    }
    const row = exportRecord(collection);
    const restored = parseDataBundle(buildDataBundle(readLocalCollections()));
    expect(restored[collection][0]).toEqual(expect.objectContaining(row));
  });
  it("excludes a removed creator's cached group and schedule until they rejoin", async () => {
    for (const key of ["groups", "groupMembers", "groupConventionDays"] as const) {
      offlineRuntime.upsertSyncedEntityRow(key, key, "u1", exportRecord(key));
    }
    const before = parseDataBundle(buildDataBundle(readLocalCollections()));
    expect(before.groups).toEqual([exportRecord("groups")]);
    expect(before.groupConventionDays).toEqual([exportRecord("groupConventionDays")]);

    await offlineRuntime.writeEntityOverlay("groupMembers", "groupMembers", "u1", null, true);
    offlineRuntime.upsertSyncedEntityRow("groups", "groups", "u1", {
      ...exportRecord("groups"),
      description: "Changed after removal",
    });
    offlineRuntime.upsertSyncedEntityRow("groupConventionDays", "groupConventionDays", "u1", {
      ...exportRecord("groupConventionDays"),
      date: "2026-11-02",
    });
    const removed = parseDataBundle(buildDataBundle(readLocalCollections()));
    expect(removed.groups).toEqual([]);
    expect(removed.groupConventionDays).toEqual([]);

    offlineRuntime.upsertSyncedEntityRow("groupMembers", "rejoined", "u1", {
      ...exportRecord("groupMembers"),
      _id: "rejoined",
      id: "rejoined",
    });
    const rejoined = readLocalCollections();
    expect(rejoined.groups).toEqual([
      expect.objectContaining({ description: "Changed after removal" }),
    ]);
    expect(rejoined.groupConventionDays).toEqual([expect.objectContaining({ date: "2026-11-02" })]);
  });

  it("exports elements alongside the task attachments that reference them", () => {
    offlineRuntime.upsertSyncedEntityRow("cosplayNodes", "node", "u1", {
      _id: "node",
      userId: "u1",
      nodeType: "element",
      name: "Wig",
      tags: [],
    });
    offlineRuntime.upsertSyncedEntityRow("workflowItems", "task", "u1", {
      _id: "task",
      userId: "u1",
      title: "Style wig",
    });
    offlineRuntime.upsertSyncedEntityRow("workflowAttachments", "attachment", "u1", {
      _id: "attachment",
      userId: "u1",
      workflowItemId: "task",
      entityType: "cosplayNode",
      entityId: "node",
      role: "primary",
    });
    const restored = parseDataBundle(buildDataBundle(readLocalCollections()));
    expect(restored.cosplayNodes).toEqual([expect.objectContaining({ id: "node", name: "Wig" })]);
    expect(restored.workflowItems[0].attachments).toEqual([
      expect.objectContaining({ entityType: "cosplayNode", entityId: "node" }),
    ]);
  });
  it("returns a FREE user's locally-created rows so their export is not empty", async () => {
    // A free user's data lives only in the local store (never synced to Convex). Seed a synced base
    // row and an unsynced optimistic overlay across two collections.
    offlineRuntime.upsertSyncedEntityRow("builds", "b1", "u1", {
      _id: "b1",
      userId: "u1",
      name: "Aerith",
      status: "wip",
    });
    await offlineRuntime.writeEntityOverlay(
      "conventions",
      "local:c1",
      "u1",
      { _id: "local:c1", userId: "u1", name: "AnimeExpo", startDate: "2026-07-01" },
      false
    );

    const collections = readLocalCollections();

    expect(collections.builds.map((r) => r.id)).toEqual(["b1"]);
    expect(collections.conventions.map((r) => r.id)).toEqual(["local:c1"]);

    // The whole point of the defect fix: a real, non-empty bundle for a cloud-less free user.
    const bundle = buildDataBundle(collections);
    expect(countRows(collections)).toBe(2);
    expect(countRows(parseDataBundle(bundle))).toBe(2);
  });

  it("omits locally-deleted (tombstoned) rows from the export", async () => {
    offlineRuntime.upsertSyncedEntityRow("builds", "b1", "u1", {
      _id: "b1",
      userId: "u1",
      name: "Keep",
    });
    offlineRuntime.upsertSyncedEntityRow("builds", "b2", "u1", {
      _id: "b2",
      userId: "u1",
      name: "Gone",
    });
    await offlineRuntime.writeEntityOverlay("builds", "b2", "u1", null, true);

    const collections = readLocalCollections();
    expect(collections.builds.map((r) => r.id)).toEqual(["b1"]);
  });
});

describe("web personal writes go to Convex, not the local store (ADR-0006)", () => {
  it("sends an online create to Convex and leaves the local store untouched", async () => {
    setOfflineConnectivity(true);
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    await result.current({ userId: "u1", name: "Cloud", status: "wip" } as never);
    expect(client.mutation).toHaveBeenCalledOnce();
    expect(readLocalCollections().builds).toEqual([]);
  });
});
