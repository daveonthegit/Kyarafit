import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
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
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : state.builds),
  useConvex: () => client,
}));

import { api } from "convex/_generated/api";
import { useOfflineMutation } from "./useOfflineMutation";
import { useBuildsList } from "@/lib/builds/useBuildsList";
import { OfflineRuntime, offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { createRestoreSession, undoRestoreSession } from "../restoreSession";
import { RESTORE_SESSION_KEY, RestoreInProgressError } from "./restoreState";
import { setStoredLocale } from "../i18n/locale";

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
  vi.unstubAllGlobals();
});

describe("offline bridge (REQ-D51 / REQ-D52)", () => {
  it("refuses writes from a stale tab using the shared durable restore session", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const shared = new InMemoryLocalStore();
    const tabA = new OfflineRuntime();
    tabA.setStore(shared, "u1");
    offlineRuntime.setStore(shared, "u1");
    await offlineRuntime.hydrate();
    await tabA.setMeta(RESTORE_SESSION_KEY, JSON.stringify({ id: "tab-a-session", created: [] }));
    expect(offlineRuntime.getRestoreInProgress()).toBe(false);
    const { result } = renderHook(() => ({
      create: useOfflineMutation(api.builds.create),
      edit: useOfflineMutation(api.builds.update),
    }));
    setOfflineConnectivity(true);
    await expect(
      result.current.create({ userId: "u1", name: "Online", status: "idea" })
    ).rejects.toBeInstanceOf(RestoreInProgressError);
    setOfflineConnectivity(false);
    await expect(
      result.current.create({ userId: "u1", name: "Offline", status: "idea" })
    ).rejects.toBeInstanceOf(RestoreInProgressError);
    await expect(
      result.current.edit({ id: "restored-task" as never, name: "Edit" })
    ).rejects.toBeInstanceOf(RestoreInProgressError);
    expect(client.mutation).not.toHaveBeenCalled();
    expect(await shared.listPendingMutations()).toEqual([]);
    await undoRestoreSession({ subject: "u1", deleteRow: async () => {} });
    await act(async () => {
      await result.current.create({ userId: "u1", name: "Allowed offline", status: "idea" });
    });
    expect(await shared.listPendingMutations()).toHaveLength(1);
    setOfflineConnectivity(true);
    await result.current.create({ userId: "u1", name: "Allowed online", status: "idea" });
    expect(client.mutation).toHaveBeenCalledTimes(1);
    tabA.lock();
  });

  it.each([true, false])(
    "refuses create, edit, and delete during an incomplete restore, including after reopen (online=%s)",
    async (online) => {
      setOfflineConnectivity(online);
      const session = createRestoreSession("u1");
      await session.start();
      await session.record("builds", "restored-build");
      const store = offlineRuntime.getStore();
      offlineRuntime.lock();
      offlineRuntime.setStore(store, "u1");
      const { result } = renderHook(() => ({
        create: useOfflineMutation(api.builds.create),
        edit: useOfflineMutation(api.builds.update),
        remove: useOfflineMutation(api.builds.remove),
      }));
      await expect(
        result.current.create({ userId: "u1", name: "New", status: "idea" })
      ).rejects.toBeInstanceOf(RestoreInProgressError);
      await expect(
        result.current.edit({ id: "restored-build" as never, name: "Changed" })
      ).rejects.toBeInstanceOf(RestoreInProgressError);
      await expect(result.current.remove({ id: "restored-build" as never })).rejects.toBeInstanceOf(
        RestoreInProgressError
      );
      expect(client.mutation).not.toHaveBeenCalled();
      expect(await offlineRuntime.listPendingMutations()).toEqual([]);
      expect(window.alert).toHaveBeenCalledTimes(3);
      expect(window.alert).toHaveBeenCalledWith("Finish or undo your restore first.");

      await act(async () => undoRestoreSession({ subject: "u1", deleteRow: async () => {} }));
      await act(async () => {
        await result.current.create({ userId: "u1", name: "Allowed", status: "idea" });
      });
      expect(offlineRuntime.getRestoreInProgress()).toBe(false);
      expect(client.mutation).toHaveBeenCalledTimes(online ? 1 : 0);
      expect(await offlineRuntime.listPendingMutations()).toHaveLength(online ? 0 : 1);
    }
  );

  it("reports the restore write refusal in the selected locale", async () => {
    const session = createRestoreSession("u1");
    await session.start();
    await session.record("builds", "restored-build");
    setStoredLocale("es");
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    try {
      await expect(result.current({ userId: "u1", name: "New", status: "idea" })).rejects.toThrow(
        "Termina o deshaz la restauración primero."
      );
      expect(window.alert).toHaveBeenCalledWith("Termina o deshaz la restauración primero.");
    } finally {
      setStoredLocale("en");
    }
  });

  it("allows a non-planner upload URL request while restore is incomplete", async () => {
    const session = createRestoreSession("u1");
    await session.start();
    await session.record("builds", "restored-build");
    const { result } = renderHook(() => useOfflineMutation(api.files.generateUploadUrl));
    await result.current({});
    expect(client.mutation).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "rejects writes during a local account switch before the next vault opens (online=%s)",
    async (online) => {
      setOfflineConnectivity(online);
      const { result } = renderHook(() => useOfflineMutation(api.builds.create));
      const retained = result.current;
      rememberLocalAccount("other-account");
      await expect(retained({ userId: "u1", name: "Wrong vault", status: "idea" })).rejects.toThrow(
        "active account changed"
      );
      expect(await offlineRuntime.listPendingMutations()).toEqual([]);
      expect(client.mutation).not.toHaveBeenCalled();
    }
  );

  it("does not read or cache another account's data while switching vaults", () => {
    state.builds = [{ _id: "a", userId: "u1", name: "A", status: "idea" }];
    const { result, rerender } = renderHook(() =>
      useBuildsList({
        userId: "u1",
        view: { tab: "all", search: "", sortBy: "name", order: "asc" },
      })
    );
    expect(result.current.builds).toHaveLength(1);
    const cache = vi.spyOn(offlineRuntime, "writeQueryCache");
    rememberLocalAccount("other-account");
    state.builds = [{ _id: "b", userId: "other-account", name: "B", status: "idea" }];
    rerender();
    expect(result.current.builds).toEqual([]);
    expect(cache).not.toHaveBeenCalled();
  });
  it("queues and replays an ordinary packing create with its row identity", async () => {
    setOfflineConnectivity(false);
    const { result } = renderHook(() => useOfflineMutation(api.conventions.addManualPackingItem));
    let clientId = "";
    await act(async () => {
      const created = await result.current({
        userId: "u1",
        conventionId: "server-con" as never,
        label: "Tape",
      });
      expect(created).toMatchObject({ label: "Tape" });
      expect(created).not.toHaveProperty("workflowItemId");
      clientId = created!._id;
    });
    expect(client.mutation).not.toHaveBeenCalled();
    expect(await offlineRuntime.listPendingMutations()).toHaveLength(1);
    client.mutation.mockResolvedValueOnce({ _id: "server-pack" });
    setOfflineConnectivity(true);
    expect(await drainMutationQueue(client as never)).toEqual({ processed: 1, failed: 0 });
    expect(getFunctionName(client.mutation.mock.calls[0][0] as never)).toBe(
      "conventions:addManualPackingItem"
    );
    expect(client.mutation.mock.calls[0][1]).toMatchObject({
      conventionId: "server-con",
      label: "Tape",
    });
    expect(await offlineRuntime.loadIdMap()).toEqual({ [clientId]: "server-pack" });
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
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
