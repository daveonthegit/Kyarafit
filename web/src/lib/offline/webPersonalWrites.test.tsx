import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "convex/_generated/api";
import { useOfflineMutation } from "./useOfflineMutation";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";
import { dismissWriteFailure, writeFailures } from "./writeFailures";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { WriteFailureToast } from "@/components/WriteFailureToast";

// ADR-0006: web edits personal data again. Each mutation below is one the web UI calls through
// useOfflineMutation, grouped by the module the old client-side refusal blocked. Online, every one
// must reach the real Convex mutation unchanged; offline, none may be sent or queued, and the
// failure must be reported app-wide.

const client = vi.hoisted(() => ({ mutation: vi.fn(async () => ({ ok: true })) }));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string>): string =>
      values?.reason ? `${key}: ${values.reason}` : key,
}));

type AnyMutation = FunctionReference<"mutation">;

const WEB_PERSONAL_WRITES: Record<string, AnyMutation[]> = {
  builds: [
    api.builds.create,
    api.builds.update,
    api.builds.removeMany,
    api.builds.updateStatusMany,
    api.builds.addNodesToBuild,
    api.builds.linkNodes,
    api.builds.removeNodeFromBuild,
    api.builds.removeNodesFromBuild,
  ],
  conventions: [
    api.conventions.create,
    api.conventions.update,
    api.conventions.archiveMany,
    api.conventions.removeMany,
    api.conventions.replacePlan,
    api.conventions.addManualPackingItem,
    api.conventions.updatePackingItem,
    api.conventions.deletePackingItem,
    api.conventions.regeneratePacking,
  ],
  cosplayNodes: [
    api.cosplayNodes.create,
    api.cosplayNodes.update,
    api.cosplayNodes.remove,
    api.cosplayNodes.removeMany,
    api.cosplayNodes.convertType,
    api.cosplayNodes.addChildLink,
    api.cosplayNodes.removeChildLink,
    api.cosplayNodes.reorderChildren,
  ],
  buildTasks: [api.buildTasks.create, api.buildTasks.update, api.buildTasks.remove],
  workflow: [api.workflow.create, api.workflow.update, api.workflow.move, api.workflow.remove],
  buildReferenceImages: [
    api.buildReferenceImages.add,
    api.buildReferenceImages.remove,
    api.buildReferenceImages.reorder,
  ],
  buildProcessPictures: [
    api.buildProcessPictures.add,
    api.buildProcessPictures.remove,
    api.buildProcessPictures.reorder,
  ],
  buildProgressUpdates: [api.buildProgressUpdates.add],
};

const cases = Object.entries(WEB_PERSONAL_WRITES).flatMap(([module, refs]) =>
  refs.map((ref) => [module, getFunctionName(ref), ref] as const)
);

beforeEach(() => {
  vi.clearAllMocks();
  rememberLocalAccount("owner");
  offlineRuntime.setStore(new InMemoryLocalStore(), "owner");
  setOfflineConnectivity(true);
  dismissWriteFailure();
});

afterEach(() => {
  offlineRuntime.lock();
  rememberLocalAccount(null);
  setOfflineConnectivity(true);
});

describe("web personal writes reach Convex (ADR-0006)", () => {
  it("covers every module the old web refusal blocked", () => {
    expect(Object.keys(WEB_PERSONAL_WRITES).sort()).toEqual(
      [
        "buildProcessPictures",
        "buildProgressUpdates",
        "buildReferenceImages",
        "buildTasks",
        "builds",
        "conventions",
        "cosplayNodes",
        "workflow",
      ].sort()
    );
  });

  it.each(cases)("%s: %s is sent to Convex when online", async (_module, _name, ref) => {
    const args = { probe: _name };
    const { result } = renderHook(() => useOfflineMutation(ref));
    await expect(result.current(args as never)).resolves.toEqual({ ok: true });
    expect(client.mutation).toHaveBeenCalledOnce();
    expect(client.mutation).toHaveBeenCalledWith(ref, args);
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
    expect(writeFailures.getSnapshot()).toBeNull();
  });

  it.each(cases)(
    "%s: %s is not sent or queued offline, and the failure is reported",
    async (_module, _name, ref) => {
      setOfflineConnectivity(false);
      const { result } = renderHook(() => useOfflineMutation(ref));
      await expect(result.current({} as never)).rejects.toThrow(/requires a connection/);
      expect(client.mutation).not.toHaveBeenCalled();
      expect(await offlineRuntime.listPendingMutations()).toEqual([]);
      expect(writeFailures.getSnapshot()).toMatchObject({ kind: "offline" });
    }
  );
});

describe("WriteFailureToast", () => {
  it("shows a server's reason for a rejected edit, then can be dismissed", async () => {
    client.mutation.mockRejectedValueOnce(new ConvexError("Name is too long"));
    render(<WriteFailureToast />);
    const { result } = renderHook(() => useOfflineMutation(api.builds.update));
    await act(async () => {
      await expect(result.current({} as never)).rejects.toBeInstanceOf(ConvexError);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("writeFailedReason: Name is too long");
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains an offline edit without exposing internals", async () => {
    setOfflineConnectivity(false);
    render(<WriteFailureToast />);
    const { result } = renderHook(() => useOfflineMutation(api.conventions.create));
    await act(async () => {
      await expect(result.current({} as never)).rejects.toThrow();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("writeOffline");
  });

  it("uses the generic message for an unexpected server error", async () => {
    client.mutation.mockRejectedValueOnce(new Error("[Request ID: x] Server Error"));
    render(<WriteFailureToast />);
    const { result } = renderHook(() => useOfflineMutation(api.workflow.update));
    await act(async () => {
      await expect(result.current({} as never)).rejects.toThrow();
    });
    expect(screen.getByText("writeFailed")).toBeInTheDocument();
  });
});
