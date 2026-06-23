import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

// Spec: DATA_AND_SYNC.md §6 (REQ-D60) + REQ-D10. The Convex-facing sync worker (queue drain +
// warm-up pull) runs ONLY for a paid, signed-in user. Free / signed-out users must make ZERO Convex
// data calls — the worker never touches `convex` at all. The gate is the pure `shouldRunSyncWorker`.

const { client, authState, tierState } = vi.hoisted(() => ({
  client: {
    query: vi.fn(() => Promise.resolve(null)),
    mutation: vi.fn(() => Promise.resolve(null)),
  },
  authState: { signedIn: true },
  tierState: { tier: "FREE" as string | null },
}));

vi.mock("convex/react", () => ({ useConvex: () => client }));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    userId: authState.signedIn ? "user_1" : null,
    identity: authState.signedIn ? { subject: "user_1" } : null,
    isLoading: false,
    isAuthenticated: authState.signedIn,
  }),
}));

vi.mock("@/lib/api/useTier", () => ({
  useTier: () => ({
    data: tierState.tier ? { tier: tierState.tier, currentUsageMb: 0, storageLimitMb: 50 } : null,
    isLoading: false,
  }),
}));

import { SyncWorkerProvider } from "./SyncWorkerProvider";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";

beforeEach(() => {
  vi.clearAllMocks();
  offlineRuntime.setStore(new InMemoryLocalStore());
  setOfflineConnectivity(true);
  authState.signedIn = true;
  tierState.tier = "FREE";
});

describe("SyncWorkerProvider gating (REQ-D60 / REQ-D10)", () => {
  it("should_not_call_convex_for_free_or_signed_out_user", async () => {
    authState.signedIn = true;
    tierState.tier = "FREE";

    render(
      <SyncWorkerProvider>
        <div data-testid="child" />
      </SyncWorkerProvider>
    );

    // Flush the provider's effects + any scheduled async work.
    await Promise.resolve();
    await Promise.resolve();

    expect(client.query).not.toHaveBeenCalled();
    expect(client.mutation).not.toHaveBeenCalled();
  });

  it("should_not_call_convex_when_signed_out_even_if_tier_looks_paid", async () => {
    authState.signedIn = false;
    tierState.tier = "PRO";

    render(
      <SyncWorkerProvider>
        <div />
      </SyncWorkerProvider>
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(client.query).not.toHaveBeenCalled();
    expect(client.mutation).not.toHaveBeenCalled();
  });

  it("should_run_sync_worker_for_paid_signed_in_user", async () => {
    authState.signedIn = true;
    tierState.tier = "PRO";

    render(
      <SyncWorkerProvider>
        <div />
      </SyncWorkerProvider>
    );

    // Paid + signed-in: the warm-up pull queries `sync.listChangedSince` against Convex.
    await waitFor(() => expect(client.query).toHaveBeenCalled());
  });
});
