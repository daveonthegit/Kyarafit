import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Id } from "convex/_generated/dataModel";
import { getActiveVault, lockVault, unlockVault } from "@/vault/activeVault";
import { runLocalMutation, runLocalQuery } from "@/vault/functions";
import { setReplicationEnabled } from "@/vault/replication";
import { deleteVaultDatabase, getOfflineDb } from "@/offline/db";
import type { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { WorkflowTaskEditorModal } from "./WorkflowTaskEditorModal";

const h = vi.hoisted(() => ({ close: vi.fn(), alert: vi.fn() }));
vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return { ...(await createReactNativeMock()), Alert: { alert: h.alert } };
});
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useConvex: () => ({ mutation: vi.fn() }),
}));
vi.mock("@/offline", async () => ({
  ...(await import("@/offline/useOfflineQuery")),
  ...(await import("@/offline/useOfflineMutation")),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/theme/useDesignTheme", () => ({ useDesignTheme: () => ({ colors: { textTertiary: "gray" } }) }));
vi.mock("@/ui", () => ({
  Button: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) =>
    <button disabled={disabled} onClick={onPress}>{title}</button>,
}));

type Task = { _id: Id<"workflowItems">; title: string };
beforeEach(async () => {
  vi.clearAllMocks();
  await unlockVault({ subject: "task-editor-owner", lastVerifiedAt: 1 });
  setReplicationEnabled(true);
});
afterEach(async () => {
  cleanup();
  await lockVault();
  await deleteVaultDatabase("task-editor-owner");
});

it("rolls back fields, dependencies and intents when the second write fails, then saves atomically on retry", async () => {
  const task = runLocalMutation("workflow:create", { title: "Original", status: "not_started", dueDate: "2026-11-01", notes: "Original notes" }) as Task;
  const oldDependency = runLocalMutation("workflow:create", { title: "Old dependency" }) as Task;
  const newDependency = runLocalMutation("workflow:create", { title: "New dependency" }) as Task;
  runLocalMutation("workflow:setDependencies", { workflowItemId: task._id, dependencies: [{ predecessorWorkflowItemId: oldDependency._id, relationKind: "blocks" }] });
  const sql = getOfflineDb() as unknown as NodeSqliteDatabase;
  const before = sql.getAllSync("SELECT * FROM entity_rows ORDER BY table_name, id");
  const queuedBefore = sql.getAllSync("SELECT * FROM mutation_queue ORDER BY id");
  const editorBefore = runLocalQuery("workflow:getItemEditorState", { id: task._id });
  render(<WorkflowTaskEditorModal visible workflowItemId={task._id} userId="task-editor-owner" candidateTasks={[oldDependency, newDependency]} onClose={h.close} />);
  fireEvent.change(screen.getByPlaceholderText("planner.addTaskPlaceholder"), { target: { value: "Changed" } });
  fireEvent.change(screen.getByPlaceholderText("workflowEditor.dueDatePlaceholder"), { target: { value: "2026-12-02" } });
  fireEvent.change(screen.getByPlaceholderText("elements.notesPlaceholder"), { target: { value: "Changed notes" } });
  fireEvent.click(screen.getByText("in progress"));
  fireEvent.click(screen.getByText("Old dependency"));
  fireEvent.click(screen.getByText("New dependency"));
  let writes = 0;
  sql.failNextWrite = (source) => source.includes("INSERT INTO entity_rows") && ++writes === 2;
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(h.alert).toHaveBeenCalled());
  expect(writes).toBe(2);
  expect(h.close).not.toHaveBeenCalled();
  expect(sql.getAllSync("SELECT * FROM entity_rows ORDER BY table_name, id")).toEqual(before);
  expect(sql.getAllSync("SELECT * FROM mutation_queue ORDER BY id")).toEqual(queuedBefore);
  act(() => getActiveVault()!.reloadFromDisk());
  expect(runLocalQuery("workflow:getItemEditorState", { id: task._id })).toEqual(editorBefore);
  expect((screen.getByPlaceholderText("planner.addTaskPlaceholder") as HTMLInputElement).value).toBe("Changed");
  fireEvent.click(screen.getByRole("button", { name: "common.save" }));
  await waitFor(() => expect(h.close).toHaveBeenCalledTimes(1));
  expect(runLocalQuery("workflow:getItemEditorState", { id: task._id })).toMatchObject({
    title: "Changed", status: "in_progress", notes: "Changed notes", dueDate: "2026-12-02", predecessorIds: [newDependency._id],
  });
  expect(sql.getAllSync("SELECT * FROM mutation_queue")).toHaveLength(queuedBefore.length + 2);
});
