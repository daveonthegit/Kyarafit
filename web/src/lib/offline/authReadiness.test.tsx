import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { getFunctionName } from "convex/server";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTier } from "@/lib/api/useTier";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import { rememberLocalAccount } from "../auth/localAccount";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { useOfflineQuery } from "./useOfflineQuery";

const state = vi.hoisted(() => ({ authenticated: false, query: vi.fn() }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: !state.authenticated }),
  useQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(query);
    state.query(name, args);
    if (name === "auth:getCurrentUser") {
      return state.authenticated ? { subject: "owner" } : null;
    }
    if (args === "skip") return undefined;
    return name === "users:getMe" ? null : [];
  },
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => ({ data: {}, isPending: false }) },
}));
afterEach(() => {
  cleanup();
  offlineRuntime.lock();
  rememberLocalAccount(null);
  state.authenticated = false;
  vi.clearAllMocks();
});

it("keeps remembered-account cache available without starting an unauthenticated planner query", async () => {
  rememberLocalAccount("owner");
  offlineRuntime.setStore(new InMemoryLocalStore(), "owner");
  const args = { userId: "owner" };
  const cached = [{ _id: "task", title: "Saved task" }];
  await act(async () =>
    offlineRuntime.writeQueryCache(offlineQueryKey("workflow:listPlanner", args)!, cached)
  );
  const view = renderHook(() => {
    const account = useCurrentUser();
    const tasks = useOfflineQuery(api.workflow.listPlanner, { userId: account.userId! });
    useTier();
    return { account, tasks };
  });
  expect(view.result.current.account.userId).toBe("owner");
  expect(view.result.current.account.isAuthenticated).toBe(false);
  expect(state.query).toHaveBeenCalledWith("workflow:listPlanner", "skip");
  expect(state.query).toHaveBeenCalledWith("users:getMe", "skip");
  expect(view.result.current.tasks).toEqual(cached);
  state.query.mockClear();
  state.authenticated = true;
  view.rerender();
  expect(state.query).toHaveBeenCalledWith("workflow:listPlanner", args);
  expect(state.query).toHaveBeenCalledWith("users:getMe", { externalId: "owner" });
  expect(view.result.current.tasks).toEqual([]);
});
