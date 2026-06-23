import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

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
  client: { mutation: vi.fn(() => Promise.resolve(null)) },
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

beforeEach(() => {
  vi.clearAllMocks();
  offlineRuntime.setStore(new InMemoryLocalStore());
  state.builds = [];
});

afterEach(() => {
  setOfflineConnectivity(true);
});

describe("offline bridge (REQ-D51 / REQ-D52)", () => {
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
