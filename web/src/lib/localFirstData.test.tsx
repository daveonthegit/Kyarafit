import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Spec: DATA_AND_SYNC.md §11 (REQ-D100 "export is free") + invariant #2 ("UI reads/writes only
// through the offline bridge for local-first data"). A FREE user has NO cloud data, so an export
// sourced from Convex (`sync.listChangedSince`) would be EMPTY. Sourcing it from the LOCAL STORE
// makes it non-empty, and imports written through the offline bridge land in the local store.

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
  emptyCollections,
  parseDataBundle,
  runImport,
  summarizeTotals,
  type CreateRowFn,
} from "./dataPortability";

beforeEach(() => {
  vi.clearAllMocks();
  rememberLocalAccount("u1");
  offlineRuntime.setStore(new InMemoryLocalStore(), "u1");
});

afterEach(() => {
  setOfflineConnectivity(true);
});

describe("readLocalCollections (REQ-D100 — export is free)", () => {
  it("exports elements alongside the task attachments that reference them", () => {
    offlineRuntime.upsertSyncedEntityRow("cosplayNodes", "node", "u1", {
      _id: "node", userId: "u1", nodeType: "element", name: "Wig", tags: [],
    });
    offlineRuntime.upsertSyncedEntityRow("workflowItems", "task", "u1", {
      _id: "task", userId: "u1", title: "Style wig",
    });
    offlineRuntime.upsertSyncedEntityRow("workflowAttachments", "attachment", "u1", {
      _id: "attachment", userId: "u1", workflowItemId: "task",
      entityType: "cosplayNode", entityId: "node", role: "primary",
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

describe("import writes land in the local store (invariant #2)", () => {
  it("routes imported rows through the offline bridge into the local store", async () => {
    setOfflineConnectivity(false);

    // The page uses `useOfflineMutation(api.builds.create)` as its import sink.
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));

    const createRow: CreateRowFn = async (_collection, row) => {
      return result.current({
        userId: "u1",
        name: String(row.name ?? "Untitled build"),
        status: String(row.status ?? "idea"),
        idempotencyKey: `import:builds:${row.id}`,
      });
    };

    const imported = parseDataBundle(
      buildDataBundle({
        ...emptyCollections(),
        builds: [
          { id: "b1", name: "Cloud", status: "wip" },
          { id: "b2", name: "Tifa", status: "idea" },
        ],
      })
    );

    await act(async () => {
      const summary = await runImport({ imported, existing: emptyCollections(), createRow });
      expect(summarizeTotals(summary)).toEqual({ added: 2, skipped: 0 });
    });

    // Offline: nothing was sent to Convex — the writes were queued into the local store instead.
    expect(client.mutation).not.toHaveBeenCalled();
    const pending = await offlineRuntime.listPendingMutations();
    expect(pending).toHaveLength(2);
    expect(pending.every((m) => m.fn === "builds:create")).toBe(true);

    // And they are immediately re-exportable from the local store (overlay-visible before sync).
    const collections = readLocalCollections();
    expect(collections.builds.map((r) => r.name).sort()).toEqual(["Cloud", "Tifa"]);
  });
});
