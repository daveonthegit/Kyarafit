import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Id } from "convex/_generated/dataModel";
import { getActiveVault, lockVault, unlockVault } from "@/vault/activeVault";
import { runLocalMutation } from "@/vault/functions";
import { deleteVaultDatabase, getOfflineDb } from "@/offline/db";
import type { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { useNodeInspector, type NodeSelectionMeta } from "../useNodeInspector";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useConvex: () => ({ mutation: vi.fn() }),
}));
vi.mock("@/offline", async () => ({
  ...(await import("@/offline/useOfflineQuery")),
  ...(await import("@/offline/useOfflineMutation")),
}));

type Node = { _id: Id<"cosplayNodes"> };
let buildId: Id<"builds">;
let first: Node;
let second: Node;

beforeEach(async () => {
  vi.useFakeTimers();
  await unlockVault({ subject: "inspector-owner", lastVerifiedAt: 1 });
  buildId = (runLocalMutation("builds:create", { name: "Build", status: "idea" }) as { _id: Id<"builds"> })._id;
  first = runLocalMutation("cosplayNodes:create", { name: "First", nodeType: "element" }) as Node;
  second = runLocalMutation("cosplayNodes:create", { name: "Second", nodeType: "element" }) as Node;
  runLocalMutation("builds:addNodesToBuild", { buildId, cosplayNodeIds: [first._id, second._id] });
});
afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  await lockVault();
  await deleteVaultDatabase("inspector-owner");
});

it.each(["select", "clear"])("keeps a failed draft when attempting to %s, then permits retry", async (action) => {
  const { result } = renderHook(() => useNodeInspector({ buildId, userId: "inspector-owner" }));
  await act(async () => { expect(await result.current.commitSelection({ nodeId: first._id, isRoot: true })).toBe(true); });
  act(() => result.current.setInspectorForm((form) => ({ ...form, name: "Unsaved draft", notes: "Keep me" })));
  const sql = getOfflineDb() as unknown as NodeSqliteDatabase;
  sql.failNextWrite = (source) => source.includes("INSERT INTO entity_rows");
  const next = action === "select" ? { nodeId: second._id, isRoot: true } : null;
  await act(async () => { expect(await result.current.commitSelection(next)).toBe(false); });
  expect(result.current.selected?.nodeId).toBe(first._id);
  expect(result.current.inspectorForm).toMatchObject({ name: "Unsaved draft", notes: "Keep me" });
  expect(result.current.persistStatus).toBe("error");
  expect(getActiveVault()!.reader().get(first._id)?.name).toBe("First");
  await act(async () => { expect(await result.current.commitSelection(next)).toBe(true); });
  expect(result.current.selected).toEqual(next);
  expect(getActiveVault()!.reader().get(first._id)).toMatchObject({ name: "Unsaved draft", notes: "Keep me" });
});

it.each([{ name: "" }, { directCostDollars: "not a price" }])("keeps invalid draft values instead of clearing selection (%j)", async (fields) => {
  const { result } = renderHook(() => useNodeInspector({ buildId, userId: "inspector-owner" }));
  await act(async () => { await result.current.commitSelection({ nodeId: first._id, isRoot: true }); });
  act(() => result.current.setInspectorForm((form) => ({ ...form, ...fields })));
  await act(async () => { expect(await result.current.flushSave()).toBe(false); });
  await act(async () => { expect(await result.current.commitSelection(null)).toBe(false); });
  expect(result.current.selected?.nodeId).toBe(first._id);
  expect(result.current.inspectorForm).toMatchObject(fields);
});

it.each([true, false])("does not unlink after a failed save (root=%s)", async (isRoot) => {
  if (!isRoot) runLocalMutation("cosplayNodes:addChildLink", { parentNodeId: second._id, childNodeId: first._id });
  const selection: NodeSelectionMeta = { nodeId: first._id, isRoot, siblingLinkIds: [first._id], siblingIndex: 0 };
  const { result } = renderHook(() => useNodeInspector({ buildId, userId: "inspector-owner" }));
  await act(async () => { await result.current.commitSelection(selection); });
  act(() => result.current.setInspectorForm((form) => ({ ...form, name: "Keep draft" })));
  const before = getActiveVault()!.reader().get(first._id);
  (getOfflineDb() as unknown as NodeSqliteDatabase).failNextWrite = (source) => source.includes("INSERT INTO entity_rows");
  await act(async () => { expect(await result.current.unlinkSelected()).toBe(false); });
  expect(result.current.selected).toEqual(selection);
  expect(result.current.inspectorForm.name).toBe("Keep draft");
  expect(getActiveVault()!.reader().get(first._id)).toEqual(before);
  await act(async () => { expect(await result.current.unlinkSelected()).toBe(true); });
  expect(result.current.selected).toBeNull();
  const saved = getActiveVault()!.reader().get(first._id)!;
  expect(saved.name).toBe("Keep draft");
  if (isRoot) expect(saved.buildId).toBeUndefined();
  else expect(saved.parentNodeId).toBeUndefined();
});
