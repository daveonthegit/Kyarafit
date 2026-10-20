import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { useOfflineMutation } from "./useOfflineMutation";
import { useOfflineQuery } from "./useOfflineQuery";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";

const { client, state } = vi.hoisted(() => ({
  client: { mutation: vi.fn(async () => null) },
  state: { live: [{ _id: "published", name: "Published" }] as unknown },
}));
vi.mock("convex/react", () => ({
  useConvex: () => client,
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => state.live,
}));
beforeEach(() => {
  vi.clearAllMocks();
  rememberLocalAccount("u1");
  offlineRuntime.setStore(new InMemoryLocalStore(), "u1");
  setOfflineConnectivity(true);
});

describe("published web views", () => {
  it.each([true, false])("refuses personal edits online=%s without queueing or calling Convex", async online => {
    setOfflineConnectivity(online);
    const { result } = renderHook(() => useOfflineMutation(api.builds.create));
    await expect(result.current({ name: "Private", status: "idea" })).rejects.toThrow(/mobile app/);
    expect(client.mutation).not.toHaveBeenCalled();
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
  });
  it("does not overlay retained legacy edits onto published views", async () => {
    await offlineRuntime.writeEntityOverlay("builds", "local:old", "u1", { _id: "local:old", name: "Old" }, false);
    const { result } = renderHook(() => useOfflineQuery(api.builds.list, {}));
    expect(result.current).toEqual(state.live);
  });
  it("keeps online social actions available", async () => {
    const { result } = renderHook(() => useOfflineMutation(api.follows.follow));
    await result.current({ followingId: "friend" });
    expect(client.mutation).toHaveBeenCalledOnce();
  });
  it("rejects a retained callback after switching accounts", async () => {
    const { result } = renderHook(() => useOfflineMutation(api.follows.follow));
    const retained = result.current;
    offlineRuntime.setStore(new InMemoryLocalStore(), "other");
    await expect(retained({ followingId: "friend" })).rejects.toThrow(/account changed/);
    expect(client.mutation).not.toHaveBeenCalled();
  });
});
