import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import { api } from "convex/_generated/api";
import { rememberLocalAccount } from "../auth/localAccount";
import { InMemoryLocalStore } from "./localStore";
import { offlineRuntime } from "./runtime";
import { useOfflineQuery } from "./useOfflineQuery";

const { live } = vi.hoisted(() => ({ live: [{ _id: "build", userId: "owner", name: "Build" }] }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => live,
}));

beforeEach(() => {
  rememberLocalAccount("owner");
  offlineRuntime.lock();
});
afterEach(() => {
  offlineRuntime.lock();
  rememberLocalAccount(null);
});

describe("query cache vault readiness", () => {
  it.each([null, "other-owner"])(
    "persists an unchanged live result when the matching vault replaces %s",
    async (initialSubject) => {
      const wrongStore = new InMemoryLocalStore();
      offlineRuntime.setStore(wrongStore, initialSubject);
      const args = { userId: "owner" };
      const key = offlineQueryKey("builds:list", args)!;
      renderHook(() => useOfflineQuery(api.builds.list, args));
      expect(await wrongStore.readQueryCache(key)).toBeUndefined();
      const store = new InMemoryLocalStore();
      await act(async () => offlineRuntime.setStore(store, "owner"));
      await waitFor(async () => {
        const cached = await store.readQueryCache(key);
        expect(cached).toBeDefined();
        expect(JSON.parse(cached!.payloadJson)).toEqual(live);
      });
      expect(await wrongStore.readQueryCache(key)).toBeUndefined();
    }
  );
});
