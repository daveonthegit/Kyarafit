import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { emptyCollections, runImport } from "../dataPortability";
import { drainMutationQueue } from "./syncWorker";

// Spec: DATA_AND_SYNC.md §5 (REQ-D51/D52). The offline bridge serves the last local snapshot
// immediately and applies offline writes optimistically: a create appends to the mutation queue and
// is shown via the entity overlay BEFORE it syncs, with zero direct Convex calls while offline.

interface TestBuild {
  _id: string;
  userId: string;
  name: string;
  status: string;
  manualProgressPercent?: number | null;
  workflowProgressPercent?: number | null;
  nodeProgressPercent?: number | null;
  packingProgressPercent?: number | null;
  budgetCents?: number | null;
  targetDate?: string | null;
  character?: string | null;
}

const { client, state } = vi.hoisted(() => ({
  client: { mutation: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null) },
  state: { builds: [] as TestBuild[] },
}));

vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : state.builds),
  useConvex: () => client,
}));

import { api } from "convex/_generated/api";
import { useOfflineMutation } from "./useOfflineMutation";
import { useBuildsList } from "@/lib/builds/useBuildsList";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  rememberLocalAccount("u1");
  offlineRuntime.setStore(new InMemoryLocalStore(), "u1");
  state.builds = [];
});

afterEach(() => {
  setOfflineConnectivity(true);
  vi.restoreAllMocks();
});

describe("offline bridge (REQ-D51 / REQ-D52)", () => {
  it.each([true, false])("rejects writes during a local account switch before the next vault opens (online=%s)", async (online) => {
    setOfflineConnectivity(online);
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    const retained = result.current;
    rememberLocalAccount("other-account");
    await expect(retained({ userId: "u1", name: "Wrong vault", status: "idea" })).rejects.toThrow("active account changed");
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
    expect(client.mutation).not.toHaveBeenCalled();
  });

  it("does not read or cache another account's data while switching vaults", () => {
    state.builds = [{ _id: "a", userId: "u1", name: "A", status: "idea" }];
    const { result, rerender } = renderHook(() => useBuildsList({
      userId: "u1", view: { tab: "all", search: "", sortBy: "name", order: "asc" },
    }));
    expect(result.current.builds).toHaveLength(1);
    const cache = vi.spyOn(offlineRuntime, "writeQueryCache");
    rememberLocalAccount("other-account");
    state.builds = [{ _id: "b", userId: "other-account", name: "B", status: "idea" }];
    rerender();
    expect(result.current.builds).toEqual([]);
    expect(cache).not.toHaveBeenCalled();
  });
  it("queues a packing restore and updates its generated task using reconciled ids", async () => {
    setOfflineConnectivity(false);
    const { result } = renderHook(() => ({
      convention: useOfflineMutation(api.conventions.create),
      packing: useOfflineMutation(api.conventions.addManualPackingItem),
      updateTask: useOfflineMutation(api.workflow.update),
    }));
    await act(async () => {
      await runImport({
        imported: {
          ...emptyCollections(),
          conventions: [{ id: "con" }],
          packingListItems: [{ id: "pack", conventionId: "con", workflowItemId: "task" }],
          workflowItems: [
            {
              id: "task",
              attachments: [{ entityType: "packingItem", entityId: "pack", role: "primary" }],
            },
          ],
        },
        existing: emptyCollections(),
        createRow: async (collection, row, existingId) => {
          if (collection === "conventions")
            return result.current.convention({
              userId: "u1",
              name: "Con",
              startDate: "2027-01-01",
              endDate: "2027-01-02",
            });
          if (collection === "packingListItems")
            return result.current.packing({
              userId: "u1",
              conventionId: row.conventionId as never,
              label: "Tape",
            });
          await result.current.updateTask({
            id: existingId as never,
            title: "Pack Tape",
            attachments: row.attachments as never,
          });
          return existingId;
        },
      });
    });
    expect(client.mutation).not.toHaveBeenCalled();
    client.mutation
      .mockResolvedValueOnce({ _id: "server-con" })
      .mockResolvedValueOnce({ _id: "server-pack", workflowItemId: "server-task" })
      .mockResolvedValueOnce({ _id: "server-task" });
    setOfflineConnectivity(true);
    expect(await drainMutationQueue(client as never)).toEqual({ processed: 3, failed: 0 });
    expect(client.mutation.mock.calls.map((call) => getFunctionName(call[0] as never))).toEqual([
      "conventions:create",
      "conventions:addManualPackingItem",
      "workflow:update",
    ]);
    expect(client.mutation.mock.calls[2][1]).toMatchObject({
      id: "server-task",
      attachments: [{ entityId: "server-pack" }],
    });
  });
  it.each([true, false])(
    "rejects a retained callback after another account signs in (online=%s)",
    async (online) => {
      const storeA = new InMemoryLocalStore();
      offlineRuntime.setStore(storeA, "account-a");
      setOfflineConnectivity(online);
      const { result } = renderHook(() => useOfflineMutation(api.builds.create));
      const retained = result.current;

      // B signs in while A's import still holds the callback.
      const storeB = new InMemoryLocalStore();
      const enqueueB = vi.spyOn(storeB, "enqueueMutation");
      act(() => offlineRuntime.setStore(storeB, "account-b"));

      await expect(
        retained({ userId: "account-a", name: "A's private build", status: "idea" })
      ).rejects.toThrow("active account changed");
      expect(client.mutation).not.toHaveBeenCalled();
      expect(enqueueB).not.toHaveBeenCalled();
      expect(offlineRuntime.listLocalEntityRowsSync("builds")).toEqual([]);
    }
  );
  it("rejects an offline create when its enqueue cannot persist", async () => {
    const store = new InMemoryLocalStore();
    vi.spyOn(store, "commitCommand").mockRejectedValueOnce(new Error("disk full"));
    offlineRuntime.setStore(store, "u1");
    setOfflineConnectivity(false);
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    await expect(result.current({ userId: "u1", name: "Unsaved", status: "idea" })).rejects.toThrow(
      "disk full"
    );
    expect(offlineRuntime.listLocalEntityRowsSync("builds")).toEqual([]);
    expect(await store.listPendingMutations()).toEqual([]);
    expect(window.alert).toHaveBeenCalledWith("Couldn't save on this device");
    await act(async () => {
      await result.current({ userId: "u1", name: "Retry", status: "idea" });
    });
    expect(await store.listPendingMutations()).toHaveLength(1);
    expect(await store.listEntityRows()).toHaveLength(1);
    expect(client.mutation).not.toHaveBeenCalled();
  });
  it.each(["status", "delete"])(
    "reports a failed bulk %s command without changing rows",
    async (action) => {
      const store = new InMemoryLocalStore();
      await store.putEntityRow({
        table: "builds",
        id: "b1",
        userId: "u1",
        json: JSON.stringify({ _id: "b1", userId: "u1", name: "Saved", status: "idea" }),
        updatedAt: 1,
        deleted: false,
        synced: true,
      });
      offlineRuntime.setStore(store, "u1");
      await offlineRuntime.hydrate();
      vi.spyOn(store, "commitCommand").mockRejectedValue(new Error("disk full"));
      setOfflineConnectivity(false);
      const { result } = renderHook(() => ({
        status: useOfflineMutation(api.builds.updateStatusMany),
        delete: useOfflineMutation(api.builds.removeMany),
      }));
      const command =
        action === "status"
          ? result.current.status({ ids: ["b1" as never], userId: "u1", status: "wip" })
          : result.current.delete({ ids: ["b1" as never], userId: "u1" });
      await expect(command).rejects.toThrow("disk full");
      expect(window.alert).toHaveBeenCalledOnce();
      expect(await store.listPendingMutations()).toEqual([]);
      expect(offlineRuntime.listLocalEntityRowsSync("builds")).toEqual([
        { _id: "b1", userId: "u1", name: "Saved", status: "idea" },
      ]);
    }
  );
  it("should_read_and_optimistically_write_builds_through_local_store", async () => {
    state.builds = [
      { _id: "b1", userId: "u1", name: "Zelda", status: "wip" },
      { _id: "b2", userId: "u1", name: "Aerith", status: "wip" },
    ];
    setOfflineConnectivity(false);

    const { result } = renderHook(() =>
      useBuildsList({
        userId: "u1",
        view: { tab: "all", search: "", sortBy: "name", order: "asc" },
      })
    );

    // Read path: the migrated slice reads the local snapshot through the bridge.
    expect(result.current.builds.map((b) => b.name)).toEqual(["Aerith", "Zelda"]);

    // Optimistic write path: an offline create is shown before it syncs.
    await act(async () => {
      await result.current.createBuild({ userId: "u1", name: "Cloud", status: "wip" });
    });

    await waitFor(() => {
      expect(result.current.builds.map((b) => b.name)).toEqual(["Aerith", "Cloud", "Zelda"]);
    });

    // Offline: nothing was sent to Convex; the write is queued for the sync worker instead.
    expect(client.mutation).not.toHaveBeenCalled();
    const pending = await offlineRuntime.listPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0].fn).toBe("builds:create");
  });

  it("should_enqueue_and_optimistically_overlay_offline_mutation", async () => {
    setOfflineConnectivity(false);

    const { result } = renderHook(() => useOfflineMutation(api.builds.create));

    let returned: unknown;
    await act(async () => {
      returned = await result.current({ userId: "u1", name: "Bayonetta", status: "idea" });
    });

    // Create resolves to an optimistic stub carrying a stable local client id.
    expect(returned).toMatchObject({ name: "Bayonetta", status: "idea" });
    const stubId = (returned as { _id: string })._id;
    expect(stubId.startsWith("local:")).toBe(true);

    // Queue enqueue: exactly one pending mutation, addressed to builds:create.
    const pending = await offlineRuntime.listPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0].fn).toBe("builds:create");
    expect(pending[0].client_id).toBe(stubId);

    // Optimistic overlay: the new row is visible in the local store overlay before sync.
    const overlay = offlineRuntime.listPendingEntityRowsSync("builds");
    expect(overlay).toHaveLength(1);
    expect(overlay[0]).toMatchObject({ id: stubId, deleted: false });
    expect(overlay[0].doc).toMatchObject({ name: "Bayonetta", _id: stubId });

    // No direct Convex call happened while offline.
    expect(client.mutation).not.toHaveBeenCalled();
  });

  it("should_call_convex_directly_when_online", async () => {
    setOfflineConnectivity(true);

    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    await act(async () => {
      await result.current({ userId: "u1", name: "Online", status: "idea" });
    });

    expect(client.mutation).toHaveBeenCalledTimes(1);
    const pending = await offlineRuntime.listPendingMutations();
    expect(pending).toHaveLength(0);
  });
});
