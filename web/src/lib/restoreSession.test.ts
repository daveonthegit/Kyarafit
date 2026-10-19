import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLocalStore } from "./offline/localStore";
import { offlineRuntime } from "./offline/runtime";
import { RestoreInProgressError } from "./offline/restoreState";
import { createRestoreSession, readRestoreSession, undoRestoreSession } from "./restoreSession";

const subject = "restore-owner";

async function writeTask(id: string, parentId?: string) {
  await offlineRuntime.writeImportedEntityRow({
    table: "workflowItems",
    id,
    userId: subject,
    json: JSON.stringify({ _id: id, userId: subject, parentId }),
    updatedAt: 1,
    deleted: false,
    synced: true,
  });
}

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  offlineRuntime.setStore(new InMemoryLocalStore(), subject);
});

afterEach(() => vi.restoreAllMocks());

describe("restore session write lock", () => {
  it("deletes every recorded row, including cascaded tasks and tasks absent locally", async () => {
    const session = createRestoreSession(subject);
    await session.record("conventions", "convention");
    await session.record("packingListItems", "packing");
    await session.record("workflowItems", "packing-task");
    await writeTask("parent");
    await writeTask("child", "parent");
    await session.record("workflowItems", "parent");
    await session.record("workflowItems", "child");
    const server = new Set(["convention", "packing", "packing-task", "parent", "child"]);
    const deleteRow = vi.fn(async (_collection: string, id: string) => {
      server.delete(id);
      if (id === "parent") server.delete("child");
    });

    expect(offlineRuntime.getRestoreInProgress()).toBe(true);
    await undoRestoreSession({ subject, deleteRow });

    expect(deleteRow.mock.calls).toEqual([
      ["workflowItems", "child"],
      ["workflowItems", "parent"],
      ["workflowItems", "packing-task"],
      ["packingListItems", "packing"],
      ["conventions", "convention"],
    ]);
    expect(server.size).toBe(0);
    expect(await offlineRuntime.getStore().listEntityRows()).toEqual([]);
    expect(await readRestoreSession(subject)).toBeNull();
    expect(offlineRuntime.getRestoreInProgress()).toBe(false);
    await expect(offlineRuntime.assertPersonalWritesAllowed()).resolves.toBeUndefined();
  });

  it("restores the lock on vault reopen and hydration and clears it on completion", async () => {
    const session = createRestoreSession(subject);
    await session.record("builds", "build");
    const store = offlineRuntime.getStore();
    offlineRuntime.lock();
    offlineRuntime.setStore(store, subject);

    await expect(offlineRuntime.assertPersonalWritesAllowed()).rejects.toBeInstanceOf(
      RestoreInProgressError
    );
    await offlineRuntime.hydrate();
    expect(offlineRuntime.getRestoreInProgress()).toBe(true);
    await session.complete();
    expect(offlineRuntime.getRestoreInProgress()).toBe(false);
    await expect(offlineRuntime.assertPersonalWritesAllowed()).resolves.toBeUndefined();
  });

  it("does not carry one account's restore lock into another account", async () => {
    const session = createRestoreSession(subject);
    await session.record("builds", "build");
    offlineRuntime.setStore(new InMemoryLocalStore(), "other-owner");
    await expect(offlineRuntime.assertPersonalWritesAllowed()).resolves.toBeUndefined();
    expect(offlineRuntime.getRestoreInProgress()).toBe(false);
  });
});
