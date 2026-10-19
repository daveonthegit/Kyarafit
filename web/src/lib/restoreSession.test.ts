import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLocalStore } from "./offline/localStore";
import { offlineRuntime } from "./offline/runtime";
import {
  createRestoreSession,
  IncompleteRestoreError,
  readRestoreSession,
  undoRestoreSession,
} from "./restoreSession";

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
  offlineRuntime.setStore(new InMemoryLocalStore(), subject);
});

describe("restore undo ownership", () => {
  it.each(["child", "grandchild"])(
    "preserves a recorded subtree containing an unrecorded %s and reports partial undo",
    async (unrecorded) => {
      const session = createRestoreSession(subject);
      await writeTask("parent");
      await writeTask("child", "parent");
      await session.record("workflowItems", "parent");
      if (unrecorded === "grandchild") {
        await session.record("workflowItems", "child");
        await writeTask("grandchild", "child");
      }
      await writeTask("safe");
      await session.record("workflowItems", "safe");
      const deleteRow = vi.fn(async () => {});

      await expect(undoRestoreSession({ subject, deleteRow })).rejects.toBeInstanceOf(
        IncompleteRestoreError
      );

      expect(deleteRow.mock.calls).toEqual([["workflowItems", "safe"]]);
      expect(offlineRuntime.listLocalEntityRowsSync("workflowItems").map((row) => row._id))
        .toEqual(expect.arrayContaining(["parent", "child"]));
      expect((await readRestoreSession(subject))?.created).toEqual([
        { collection: "workflowItems", id: "parent" },
        ...(unrecorded === "grandchild" ? [{ collection: "workflowItems", id: "child" }] : []),
      ]);
    }
  );

  it("deletes recorded children before parents regardless of recording order", async () => {
    const session = createRestoreSession(subject);
    await writeTask("child", "parent");
    await writeTask("parent");
    await writeTask("unrelated");
    await session.record("workflowItems", "child");
    await session.record("workflowItems", "parent");
    const deleteRow = vi.fn(async () => {});

    await undoRestoreSession({ subject, deleteRow });

    expect(deleteRow.mock.calls).toEqual([
      ["workflowItems", "child"],
      ["workflowItems", "parent"],
    ]);
    expect(offlineRuntime.listLocalEntityRowsSync("workflowItems").map((row) => row._id))
      .toEqual(["unrelated"]);
    expect(await readRestoreSession(subject)).toBeNull();
  });

  it("does not delete a recorded task whose local subtree is unknown", async () => {
    const session = createRestoreSession(subject);
    await session.record("workflowItems", "unknown");
    const deleteRow = vi.fn(async () => {});

    await expect(undoRestoreSession({ subject, deleteRow })).rejects.toBeInstanceOf(
      IncompleteRestoreError
    );

    expect(deleteRow).not.toHaveBeenCalled();
    expect(await readRestoreSession(subject)).not.toBeNull();
  });
});
