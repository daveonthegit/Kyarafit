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
  getOfflineDb: vi.fn(),
  enforceOfflineStorageCaps: vi.fn(),
  pruneOfflineTombstones: vi.fn(),
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: h.netInfoFetch,
    addEventListener: h.netInfoAddEventListener,
  },
}));

vi.mock("convex/react", () => ({
  useConvex: () => h.convexClient,
  useQuery: () => h.state.identity,
}));

vi.mock("convex/_generated/api", () => ({
  api: { auth: { getCurrentUser: "auth:getCurrentUser" } },
}));

vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: h.state.tier ? { tier: h.state.tier, currentUsageMb: 0, storageLimitMb: 0 } : null,
    isLoading: false,
  }),
}));

vi.mock("./db", () => ({
  getOfflineDb: h.getOfflineDb,
  enforceOfflineStorageCaps: h.enforceOfflineStorageCaps,
  pruneOfflineTombstones: h.pruneOfflineTombstones,
}));

vi.mock("./syncWorker", () => ({
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
