import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, act, waitFor } from "@testing-library/react";
import { SyncWorkerProvider } from "./SyncWorkerProvider";

/**
 * REQ-D60 / REQ-D10 (DATA_AND_SYNC.md §6): the Convex-facing sync worker (queue drain AND warm-up
 * pull) starts ONLY for a paid, signed-in user. A free signed-in user — and any signed-out user —
 * must generate ZERO Convex personal-data calls. Gating flows through the shared pure predicate
 * `shouldRunSyncWorker(tier, signedIn)` (real, not mocked here) so web/mobile stay at parity.
 */

const h = vi.hoisted(() => ({
  state: {
    identity: null as { subject: string } | null | undefined,
    tier: null as string | null,
    remoteSubject: undefined as string | null | undefined,
  },
  convexClient: {
    query: vi.fn(),
    mutation: vi.fn(),
    action: vi.fn(),
  },
  netInfoFetch: vi.fn(),
  netInfoAddEventListener: vi.fn(),
  drainMutationQueue: vi.fn(),
  warmEntityRows: vi.fn(),
  uploadLocalImages: vi.fn(),
  runBackfill: vi.fn(),
  setReplicationEnabled: vi.fn(),
  enforceOfflineStorageCaps: vi.fn(),
  pruneOfflineTombstones: vi.fn(),
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: h.netInfoFetch,
    addEventListener: h.netInfoAddEventListener,
  },
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ isPending: false, data: { user: { id: h.state.remoteSubject === undefined ? h.state.identity?.subject : h.state.remoteSubject } } }),
}));
vi.mock("@/lib/auth/bearer-storage-plugin", () => ({
  getBearerToken: () => "test-session",
  subscribeBearerToken: () => () => {},
}));
vi.mock("./syncIdentity", () => ({
  syncScope: async () => ({ current: () => Boolean(h.state.identity && (h.state.remoteSubject === undefined || h.state.remoteSubject === h.state.identity.subject)) }),
}));

vi.mock("convex/react", () => ({
  useConvex: () => h.convexClient,
}));

vi.mock("@/vault/hooks", () => ({
  useVaultState: () =>
    h.state.identity
      ? { status: "unlocked", account: { subject: h.state.identity.subject, lastVerifiedAt: 0 } }
      : { status: "locked" },
}));

vi.mock("@/vault/replication", () => ({
  setReplicationEnabled: h.setReplicationEnabled,
  onReplicationRequested: () => () => {},
}));

vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: h.state.tier ? { tier: h.state.tier, currentUsageMb: 0, storageLimitMb: 0 } : null,
    isLoading: false,
  }),
}));

vi.mock("./db", () => ({
  enforceOfflineStorageCaps: h.enforceOfflineStorageCaps,
  pruneOfflineTombstones: h.pruneOfflineTombstones,
}));

vi.mock("./syncWorker", () => ({
  invalidateSyncSession: vi.fn(),
  drainMutationQueue: h.drainMutationQueue,
  warmEntityRows: h.warmEntityRows,
  uploadLocalImages: h.uploadLocalImages,
  runBackfill: h.runBackfill,
}));

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderProvider(): void {
  render(<SyncWorkerProvider>{<span>child</span>}</SyncWorkerProvider>);
}

function expectZeroConvexCalls(): void {
  expect(h.drainMutationQueue).not.toHaveBeenCalled();
  expect(h.warmEntityRows).not.toHaveBeenCalled();
  expect(h.uploadLocalImages).not.toHaveBeenCalled();
  expect(h.runBackfill).not.toHaveBeenCalled();
  expect(h.convexClient.query).not.toHaveBeenCalled();
  expect(h.convexClient.mutation).not.toHaveBeenCalled();
  expect(h.convexClient.action).not.toHaveBeenCalled();
}

describe("SyncWorkerProvider gating (REQ-D60, REQ-D10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.identity = null;
    h.state.tier = null;
    h.state.remoteSubject = undefined;
    h.drainMutationQueue.mockResolvedValue({ processed: 0, failed: 0 });
    h.warmEntityRows.mockResolvedValue(undefined);
    h.uploadLocalImages.mockResolvedValue({ uploaded: 0, failed: 0 });
    h.runBackfill.mockResolvedValue({ running: false, done: 0, total: 0 });
    h.netInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    h.netInfoAddEventListener.mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it("does NOT start the worker (zero Convex calls) for a free, signed-in user", async () => {
    h.state.identity = { subject: "user_free" };
    h.state.tier = "FREE";

    renderProvider();
    await flushAsync();

    expectZeroConvexCalls();
  });

  it("does NOT start the worker (zero Convex calls) when signed out", async () => {
    h.state.identity = null;
    h.state.tier = null;

    renderProvider();
    await flushAsync();

    expectZeroConvexCalls();
  });

  it("does NOT start the worker for a signed-out user even with a paid tier value", async () => {
    h.state.identity = null;
    h.state.tier = "PRO";

    renderProvider();
    await flushAsync();

    expectZeroConvexCalls();
  });

  it("does not sync or persist another account's tier during a switch", async () => {
    h.state.identity = { subject: "owner" };
    h.state.remoteSubject = "other";
    h.state.tier = "PRO";
    renderProvider();
    await flushAsync();
    expectZeroConvexCalls();
    expect(h.setReplicationEnabled).not.toHaveBeenCalled();
  });

  it("persists the server-confirmed paid state so offline launches keep queueing", async () => {
    h.state.identity = { subject: "user_free" };
    h.state.tier = "FREE";
    renderProvider();
    await flushAsync();
    expect(h.setReplicationEnabled).toHaveBeenLastCalledWith(false);

    cleanup();
    h.state.identity = { subject: "user_pro" };
    h.state.tier = "PRO";
    renderProvider();
    await flushAsync();
    expect(h.setReplicationEnabled).toHaveBeenLastCalledWith(true);
  });

  it("DOES start the worker (drain then warm-up pull) for a paid, signed-in user", async () => {
    h.state.identity = { subject: "user_pro" };
    h.state.tier = "PRO";

    renderProvider();

    await waitFor(() => expect(h.drainMutationQueue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.warmEntityRows).toHaveBeenCalledTimes(1));

    expect(h.drainMutationQueue).toHaveBeenCalledWith(h.convexClient);
    expect(h.warmEntityRows).toHaveBeenCalledWith(h.convexClient);
  });

  it("treats legacy paid tiers (STUDIO) as paid and starts the worker", async () => {
    h.state.identity = { subject: "user_studio" };
    h.state.tier = "STUDIO";

    renderProvider();

    await waitFor(() => expect(h.drainMutationQueue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.warmEntityRows).toHaveBeenCalledTimes(1));
  });
});
