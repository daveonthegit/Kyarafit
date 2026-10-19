import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { setOfflineConnectivity } from "@/lib/offline/connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { readLocalCollections } from "@/lib/localFirstData";
import {
  createRestoreSession,
  readRestoreSession,
  RestoreBusyError,
  undoRestoreSession,
} from "@/lib/restoreSession";
import {
  buildDataBundle,
  emptyCollections,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
} from "@/lib/dataPortability";

// Spec: PRODUCT_SPEC.md §3/§4.9 — export/import are FREE (REQ-012). The page must offer export with no
// upgrade gate, dedupe re-imports (REQ-D101), and fail gracefully on a malformed file. Post-fix the
// page sources data from the LOCAL STORE (DATA_AND_SYNC.md §11 REQ-D100, invariant #2), not Convex, so
// a free user with no cloud data still exports their locally-created rows.

const client = {
  mutation: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  query: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
};

vi.mock("convex/react", () => ({
  useConvex: () => client,
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    userId: "user-free-1",
    identity: { subject: "user-free-1" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      title: "Data export & import",
      subtitle: "Settings",
      exportTitle: "Export your data",
      exportDescription: "Download a JSON backup. Free for everyone.",
      exportButton: "Export data",
      itemCount: `${values?.count ?? 0} item(s) ready to export`,
      loading: "Loading your data…",
      importTitle: "Import a backup",
      importDescription: "Re-importing the same file won't create duplicates.",
      importButton: "Choose a backup file",
      importing: "Importing…",
      importSummary: `Imported ${values?.added ?? 0} new item(s); skipped ${values?.skipped ?? 0} already present.`,
      importErrorGeneric: "Something went wrong while importing that file.",
      importRequiresEmptyVault: "Restore requires an empty vault. Export your current data first.",
      importRequiresOnline: "Restore needs an internet connection.",
      importIncomplete: "Restore incomplete - undo and try again.",
      restoreOtherTab: "Restore in progress in another tab",
      undoRestoreButton: "Undo restore",
      undoingRestore: "Undoing…",
      restoreUndone: "The incomplete restore was undone.",
      backToSettings: "Back to settings",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({
    title,
    subtitle,
    trailing,
  }: {
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {trailing}
    </header>
  ),
}));

describe("Settings data export/import page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.mutation.mockReset().mockResolvedValue(null);
    client.query.mockReset().mockResolvedValue({ shared: [], buildSpecific: [] });
    rememberLocalAccount("user-free-1");
    offlineRuntime.setStore(new InMemoryLocalStore(), "user-free-1");
  });

  afterEach(() => {
    setOfflineConnectivity(true);
    vi.unstubAllGlobals();
  });

  it("serializes two pages' restore and Undo and refreshes both pages after release", async () => {
    const held = new Map<string, Lock>();
    const locks = {
      request: vi.fn(
        async (
          name: string,
          options: LockOptions,
          callback: (lock: Lock | null) => Promise<unknown>
        ) => {
          expect(options).toMatchObject({ mode: "exclusive", ifAvailable: true });
          if (held.has(name)) return callback(null);
          const lock: Lock = { name, mode: "exclusive" };
          held.set(name, lock);
          try {
            return await callback(lock);
          } finally {
            held.delete(name);
          }
        }
      ),
      query: async () => ({ held: [...held.values()], pending: [] }),
    };
    vi.stubGlobal("navigator", { locks, onLine: true });
    setOfflineConnectivity(true);
    let finishCreate!: (value: { _id: string }) => void;
    const pendingCreate = new Promise<{ _id: string }>((resolve) => {
      finishCreate = resolve;
    });
    const serverRows = new Set<string>();
    client.mutation.mockImplementation(async (fn, raw) => {
      const name = getFunctionName(fn as never);
      if (name === "builds:create") {
        const created = await pendingCreate;
        serverRows.add(created._id);
        return created;
      }
      if (name === "conventions:create") throw new Error("Interrupted restore");
      if (name === "builds:remove") serverRows.delete((raw as { id: string }).id);
      return null;
    });
    const first = render(<SettingsDataPage />);
    const second = render(<SettingsDataPage />);
    const a = within(first.container);
    const b = within(second.container);
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "build", name: "Build" }],
      conventions: [{ id: "convention", name: "Con" }],
    });
    const file = new File([bundle], "backup.json", { type: "application/json" });
    fireEvent.change(a.getByTestId("import-file-input"), { target: { files: [file] } });
    expect(await b.findByTestId("restore-other-tab")).toHaveTextContent("another tab");
    expect(await b.findByRole("button", { name: "Undo restore" })).toBeDisabled();
    expect(b.getByRole("button", { name: "Choose a backup file" })).toBeDisabled();
    await waitFor(() => expect(client.mutation).toHaveBeenCalledTimes(1));

    const deleteRow = vi.fn(async () => {});
    await expect(undoRestoreSession({ subject: "user-free-1", deleteRow })).rejects.toBeInstanceOf(
      RestoreBusyError
    );
    expect(deleteRow).not.toHaveBeenCalled();
    fireEvent.change(b.getByTestId("import-file-input"), { target: { files: [file] } });
    expect(await b.findByTestId("import-error")).toHaveTextContent("another tab");
    expect(client.mutation).toHaveBeenCalledTimes(1);
    expect((await readRestoreSession("user-free-1"))?.created).toEqual([]);

    await act(async () => finishCreate({ _id: "restored-build" }));
    await a.findByTestId("import-error");
    await waitFor(() => expect(b.getByRole("button", { name: "Undo restore" })).toBeEnabled());
    expect(b.queryByTestId("restore-other-tab")).not.toBeInTheDocument();
    expect((await readRestoreSession("user-free-1"))?.created).toEqual([
      { collection: "builds", id: "restored-build" },
    ]);
    fireEvent.click(b.getByRole("button", { name: "Undo restore" }));
    await b.findByTestId("import-undone");
    await waitFor(() => expect(a.queryByTestId("import-incomplete")).not.toBeInTheDocument());
    expect(a.getByRole("button", { name: "Choose a backup file" })).toBeEnabled();
    expect(b.getByRole("button", { name: "Choose a backup file" })).toBeEnabled();
    expect(serverRows.size).toBe(0);
    expect(await offlineRuntime.getStore().listEntityRows()).toEqual([]);
    expect(await readRestoreSession("user-free-1")).toBeNull();
  });

  it("refreshes an already-open page when a session starts and completes elsewhere", async () => {
    render(<SettingsDataPage />);
    const session = createRestoreSession("user-free-1");
    await act(async () => session.start());
    await screen.findByTestId("import-incomplete");
    expect(screen.getByRole("button", { name: "Choose a backup file" })).toBeDisabled();
    await act(async () => session.complete());
    await waitFor(() => expect(screen.queryByTestId("import-incomplete")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Choose a backup file" })).toBeEnabled();
  });

  it("waits for the account vault to open before reading its restore session", async () => {
    offlineRuntime.lock();
    render(<SettingsDataPage />);
    await act(async () => {});
    expect(screen.queryByTestId("import-incomplete")).not.toBeInTheDocument();
    const store = new InMemoryLocalStore();
    const read = vi.spyOn(store, "getMeta");
    await act(async () => offlineRuntime.setStore(store, "user-free-1"));
    await waitFor(() => expect(read).toHaveBeenCalledWith("restore:session:v1"));
    expect(screen.queryByTestId("import-incomplete")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a backup file" })).toBeEnabled();
  });

  it("should_export_a_downloadable_bundle_for_free_user", async () => {
    // Capture the Blob handed to the browser download path.
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:mock-url";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    // A free user's build lives only in the local store (never synced to Convex).
    offlineRuntime.upsertSyncedEntityRow("builds", "b1", "user-free-1", {
      _id: "b1",
      userId: "user-free-1",
      name: "Aerith",
      status: "wip",
    });

    render(<SettingsDataPage />);

    // Export is available with NO upgrade gate (REQ-012): no paywall copy tying export to a tier.
    expect(
      screen.queryByText(/(upgrade|pro|paid|subscribe).*(export|import|backup)/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/(export|import|backup).*(upgrade|requires|pro|paid|subscribe)/i)
    ).not.toBeInTheDocument();

    const exportButton = screen.getByRole("button", { name: /export data/i });
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // The downloaded blob is a valid round-trippable bundle that contains the user's build.
    const text = await blobs[0].text();
    const parsed = parseDataBundle(text);
    expect(parsed.builds.map((r) => r.id)).toContain("b1");

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("restores element parents, build membership, and task attachments through the page", async () => {
    setOfflineConnectivity(true);
    client.mutation.mockImplementation(async (fn, args) => {
      if (getFunctionName(fn as never) === "builds:create") {
        expect((await readRestoreSession("user-free-1"))?.created).toEqual([]);
      }
      const row = args as { name?: string; title?: string };
      return { _id: `restored:${row.name ?? row.title ?? "link"}` };
    });
    render(<SettingsDataPage />);
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "build", name: "Build" }],
      cosplayNodes: [
        { id: "child", name: "Child", nodeType: "material", parentNodeId: "root" },
        { id: "root", name: "Root", nodeType: "element", buildId: "build" },
      ],
      workflowItems: [
        {
          id: "task",
          title: "Task",
          attachments: [
            {
              entityType: "cosplayNode",
              entityId: "child",
              role: "primary",
              buildContextId: "build",
            },
          ],
        },
      ],
    });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("Imported 4");
    expect(client.mutation.mock.calls.map(([fn]) => getFunctionName(fn as never))).toEqual([
      "builds:create",
      "cosplayNodes:create",
      "builds:addNodesToBuild",
      "cosplayNodes:create",
      "cosplayNodes:addChildLink",
      "workflow:create",
    ]);
    expect(client.mutation.mock.calls[2][1]).toMatchObject({
      buildId: "restored:Build",
      cosplayNodeIds: ["restored:Root"],
    });
    expect(client.mutation.mock.calls[4][1]).toMatchObject({
      parentNodeId: "restored:Root",
      childNodeId: "restored:Child",
    });
    expect(client.mutation.mock.calls[5][1]).toMatchObject({
      attachments: [
        {
          entityType: "cosplayNode",
          entityId: "restored:Child",
          role: "primary",
          buildContextId: "restored:Build",
        },
      ],
    });
  });

  it.each([
    { nodeType: "element", purchaseStatus: "to_buy", operation: "buy" },
    { nodeType: "element", buildStatus: "wip", operation: "wip" },
    { nodeType: "material", materialStatus: "to_buy", operation: "buy" },
    { nodeType: "material", materialStatus: "in_use", operation: "wip" },
  ])(
    "reuses generated tasks for $nodeType/$operation and refuses a second restore",
    async (state) => {
      setOfflineConnectivity(true);
      const nodes: string[] = [];
      const linked = new Set<string>();
      const tasks: {
        _id: string;
        dedupeKey?: string;
        status?: string;
        parentId?: string;
        attachments?: unknown;
      }[] = [];
      client.mutation.mockImplementation(async (fn, raw) => {
        const name = getFunctionName(fn as never);
        const args = raw as Record<string, unknown>;
        if (name === "builds:create") return { _id: "restored-build" };
        if (name === "cosplayNodes:create") {
          expect(args).not.toHaveProperty("idempotencyKey");
          const id = `node-${nodes.length + 1}`;
          nodes.push(id);
          tasks.push({
            _id: `generated-${id}`,
            dedupeKey: `autogen:${state.operation}:shared:${id}`,
          });
          return { _id: id };
        }
        if (name === "builds:addNodesToBuild") {
          for (const id of args.cosplayNodeIds as string[]) linked.add(`${args.buildId}:${id}`);
          return;
        }
        if (name === "workflow:create") {
          const task = { _id: `task-${tasks.length + 1}` };
          tasks.push(task);
          return task;
        }
        const task = tasks.find((task) => task._id === args.id);
        if (!task) throw new Error("Task not found");
        Object.assign(task, args);
        return task;
      });
      client.query.mockImplementation(async (_fn, raw) => {
        const { cosplayNodeId } = raw as { cosplayNodeId: string };
        return {
          shared: tasks.filter((task) => task.dedupeKey?.endsWith(`:${cosplayNodeId}`)),
          buildSpecific: [],
        };
      });
      const { operation, ...fields } = state;
      const bundle = buildDataBundle({
        ...emptyCollections(),
        builds: [{ id: "source-build", name: "Build" }],
        cosplayNodes: [{ id: "source-node", name: "Wig", buildId: "source-build", ...fields }],
        workflowItems: [
          { id: "source-group", title: "Group", kind: "group" },
          {
            id: "source-generated",
            title: "Restored task",
            parentId: "source-group",
            status: "done",
            dedupeKey: `autogen:${operation}:shared:source-node`,
            attachments: [
              {
                entityType: "cosplayNode",
                entityId: "source-node",
                role: "progress_source",
                buildContextId: "source-build",
              },
            ],
          },
        ],
      });
      const file = new File([bundle], "generated.json", { type: "application/json" });
      const first = render(<SettingsDataPage />);
      fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
      await waitFor(() =>
        expect(screen.getByTestId("import-summary")).toHaveTextContent("Imported 4")
      );
      expect(nodes).toEqual(["node-1"]);
      expect(linked).toEqual(new Set(["restored-build:node-1"]));
      expect(tasks).toHaveLength(2);
      expect(
        readLocalCollections("user-free-1").workflowItems.find(
          (row) => row.id === "generated-node-1"
        )
      ).toMatchObject({
        parentId: "task-2",
        dedupeKey: `autogen:${operation}:shared:node-1`,
        attachments: [{ entityId: "node-1", buildContextId: "restored-build" }],
      });
      expect(tasks[0]).toMatchObject({
        _id: "generated-node-1",
        status: "done",
        parentId: "task-2",
        attachments: [{ entityId: "node-1", buildContextId: "restored-build" }],
      });
      first.unmount();
      const store = offlineRuntime.getStore();
      offlineRuntime.lock();
      offlineRuntime.setStore(store, "user-free-1");
      render(<SettingsDataPage />);
      fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
      await waitFor(() =>
        expect(screen.getByTestId("import-error")).toHaveTextContent("empty vault")
      );
      expect(nodes).toEqual(["node-1"]);
      expect(linked).toEqual(new Set(["restored-build:node-1"]));
      expect(tasks).toHaveLength(2);
    }
  );

  it.each(["root", "child"])(
    "undoes exactly the rows of a restore interrupted at its %s attachment, then restores again",
    async (failedLink) => {
      setOfflineConnectivity(true);
      const created: string[] = [];
      const removed: string[] = [];
      let failed = false;
      client.mutation.mockImplementation(async (fn, raw) => {
        const name = getFunctionName(fn as never);
        const args = raw as Record<string, unknown>;
        if (name.endsWith(":remove") || name === "conventions:deletePackingItem") {
          removed.push(`${name}:${String(args.id)}`);
          return null;
        }
        if (name === "builds:create" || name === "cosplayNodes:create") {
          const id = `${name}:${created.length + 1}`;
          created.push(id);
          return { _id: id };
        }
        const child = name === "cosplayNodes:addChildLink";
        if (!failed && child === (failedLink === "child")) {
          failed = true;
          throw new Error("Attachment failed");
        }
        return null;
      });
      client.query.mockImplementation(async (_fn, raw) => {
        const { cosplayNodeId } = raw as { cosplayNodeId: string };
        return {
          shared: [
            { _id: `generated:${cosplayNodeId}`, dedupeKey: `autogen:buy:shared:${cosplayNodeId}` },
          ],
          buildSpecific: [],
        };
      });
      const bundle = buildDataBundle({
        ...emptyCollections(),
        builds: [{ id: "build" }],
        cosplayNodes: [
          { id: "source-root", name: "Root", nodeType: "element", buildId: "build" },
          ...(failedLink === "child"
            ? [
                {
                  id: "source-child",
                  name: "Child",
                  nodeType: "element",
                  parentNodeId: "source-root",
                },
              ]
            : []),
        ],
      });
      const file = new File([bundle], "backup.json", { type: "application/json" });
      render(<SettingsDataPage />);
      fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
      await screen.findByTestId("import-error");
      expect(await screen.findByTestId("import-incomplete")).toHaveTextContent(
        "Restore incomplete"
      );
      const interrupted = [...created];
      const queriesBeforeUndo = client.query.mock.calls.length;
      await offlineRuntime.writeImportedEntityRow({
        table: "workflowItems",
        id: "manual-after-restore",
        userId: "user-free-1",
        json: JSON.stringify({
          _id: "manual-after-restore",
          userId: "user-free-1",
          title: "Manual task",
          attachments: [{ entityType: "cosplayNode", entityId: interrupted[1] }],
        }),
        updatedAt: Date.now(),
        deleted: false,
        synced: true,
      });
      client.query.mockResolvedValue({
        shared: [{ _id: "manual-after-restore" }],
        buildSpecific: [],
      });

      // A second restore is refused while the interrupted one is pending; it is never resumed.
      client.mutation.mockClear();
      fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
      await waitFor(() =>
        expect(screen.getByTestId("import-error")).toHaveTextContent("Restore incomplete")
      );
      expect(client.mutation).not.toHaveBeenCalled();

      // An unrelated row that arrived meanwhile survives the undo.
      offlineRuntime.upsertSyncedEntityRow("builds", "unrelated", "user-free-1", {
        _id: "unrelated",
        userId: "user-free-1",
        name: "Other device",
      });
      fireEvent.click(screen.getByRole("button", { name: "Undo restore" }));
      expect(await screen.findByTestId("import-undone")).toBeInTheDocument();
      const nodes = interrupted.filter((id) => id.startsWith("cosplayNodes"));
      expect(removed).toEqual([
        ...[...nodes].reverse().map((id) => `workflow:remove:generated:${id}`),
        ...[...nodes].reverse().map((id) => `cosplayNodes:remove:${id}`),
        "builds:remove:builds:create:1",
      ]);
      const local = readLocalCollections("user-free-1");
      expect(local.builds.map((row) => row.id)).toEqual(["unrelated"]);
      expect(local.cosplayNodes).toEqual([]);
      expect(local.workflowItems.map((row) => row.id)).toEqual(["manual-after-restore"]);
      expect(client.query).toHaveBeenCalledTimes(queriesBeforeUndo);
      expect(screen.queryByTestId("import-incomplete")).not.toBeInTheDocument();
      expect(await offlineRuntime.listPendingMutations()).toEqual([]);
    }
  );

  it("records only proven element-generated tasks, including when workflow reuse is queried", async () => {
    setOfflineConnectivity(true);
    client.mutation.mockImplementation(async (fn) => {
      if (getFunctionName(fn as never) === "cosplayNodes:create") return { _id: "new-node" };
      throw new Error("Interrupted workflow restore");
    });
    client.query.mockResolvedValue({
      shared: [
        { _id: "generated", dedupeKey: "autogen:buy:shared:new-node" },
        { _id: "manual" },
        { _id: "other-node", dedupeKey: "autogen:buy:shared:other-node" },
        { _id: "other-operation", dedupeKey: "autogen:manual:shared:new-node" },
      ],
      buildSpecific: [],
    });
    render(<SettingsDataPage />);
    const bundle = buildDataBundle({
      ...emptyCollections(),
      cosplayNodes: [{ id: "node", nodeType: "element", purchaseStatus: "to_buy" }],
      workflowItems: [
        { id: "group", title: "Group", kind: "group" },
        { id: "task", parentId: "group", dedupeKey: "autogen:buy:shared:node" },
      ],
    });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    await screen.findByTestId("import-incomplete");
    expect(client.query).toHaveBeenCalledTimes(2);
    expect((await readRestoreSession("user-free-1"))?.created).toEqual([
      { collection: "cosplayNodes", id: "new-node" },
      { collection: "workflowItems", id: "generated" },
    ]);
  });

  it("undoes an interrupted packing restore even when its generated task is absent locally", async () => {
    setOfflineConnectivity(true);
    let packingCreates = 0;
    client.mutation.mockImplementation(async (fn) => {
      const name = getFunctionName(fn as never);
      if (name === "conventions:create") return { _id: "restored-convention" };
      if (name === "conventions:addManualPackingItem") {
        if (++packingCreates === 2) throw new Error("Interrupted packing restore");
        return { _id: "restored-packing", workflowItemId: "generated-packing-task" };
      }
      return null;
    });
    render(<SettingsDataPage />);
    const bundle = buildDataBundle({
      ...emptyCollections(),
      conventions: [{ id: "convention", name: "Con" }],
      packingListItems: [
        { id: "packing-1", conventionId: "convention", label: "Tape" },
        { id: "packing-2", conventionId: "convention", label: "Glue" },
      ],
    });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    await screen.findByTestId("import-incomplete");
    expect(offlineRuntime.getRestoreInProgress()).toBe(true);
    client.mutation.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Undo restore" }));
    await screen.findByTestId("import-undone");
    expect(client.mutation.mock.calls.map(([fn]) => getFunctionName(fn as never))).toEqual([
      "workflow:remove",
      "conventions:deletePackingItem",
      "conventions:remove",
    ]);
    expect(await offlineRuntime.getStore().listEntityRows()).toEqual([]);
    expect(await readRestoreSession("user-free-1")).toBeNull();
    expect(offlineRuntime.getRestoreInProgress()).toBe(false);
  });

  it("treats a row already deleted on the server as undone", async () => {
    setOfflineConnectivity(true);
    client.mutation.mockImplementation(async (fn) => {
      const name = getFunctionName(fn as never);
      if (name === "builds:create") return { _id: "restored-build" };
      if (name === "builds:remove") throw new Error("Not found or not authorized");
      throw new Error("Server unavailable");
    });
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "build", name: "Build" }],
      conventions: [{ id: "con", name: "Con" }],
    });
    render(<SettingsDataPage />);
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    await screen.findByTestId("import-incomplete");
    fireEvent.click(screen.getByRole("button", { name: "Undo restore" }));
    expect(await screen.findByTestId("import-undone")).toBeInTheDocument();
    expect(readLocalCollections("user-free-1").builds).toEqual([]);
  });

  it("refuses an offline restore before writing or queueing anything", async () => {
    setOfflineConnectivity(false);
    render(<SettingsDataPage />);
    const bundle = buildDataBundle({ ...emptyCollections(), builds: [{ id: "build" }] });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    expect(await screen.findByTestId("import-error")).toHaveTextContent("internet connection");
    expect(client.mutation).not.toHaveBeenCalled();
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
    expect(screen.queryByTestId("import-incomplete")).not.toBeInTheDocument();
  });

  it("stops at a lost connection without queueing the rest of the restore", async () => {
    setOfflineConnectivity(true);
    client.mutation.mockImplementation(async (fn) => {
      if (getFunctionName(fn as never) !== "builds:create") return null;
      setOfflineConnectivity(false);
      return { _id: "restored-build" };
    });
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "build", name: "Build" }],
      conventions: [{ id: "con", name: "Con" }],
    });
    render(<SettingsDataPage />);
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    expect(await screen.findByTestId("import-error")).toHaveTextContent("internet connection");
    expect(await screen.findByTestId("import-incomplete")).toBeInTheDocument();
    expect(client.mutation).toHaveBeenCalledTimes(1);
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
  });

  it.each(PORTABLE_COLLECTIONS)(
    "refuses a non-empty vault containing %s before writing",
    async (collection) => {
      const store = offlineRuntime.getStore();
      await store.putEntityRow({
        table: collection,
        id: "existing",
        userId: "user-free-1",
        json: JSON.stringify({ _id: "existing", userId: "user-free-1" }),
        updatedAt: 1,
        deleted: false,
        synced: true,
      });
      const before = await store.listEntityRows();
      render(<SettingsDataPage />);
      const file = new File(
        [buildDataBundle({ ...emptyCollections(), builds: [{ id: "incoming" }] })],
        "backup.json",
        { type: "application/json" }
      );
      fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
      expect(await screen.findByTestId("import-error")).toHaveTextContent("empty vault");
      expect(client.mutation).not.toHaveBeenCalled();
      expect(await store.listEntityRows()).toEqual(before);
      expect(await store.getMeta("restore:session:v1")).toBeNull();
    }
  );

  it("should_show_an_error_for_a_malformed_import_file", async () => {
    render(<SettingsDataPage />);

    const input = screen.getByTestId("import-file-input") as HTMLInputElement;
    const malformed = new File(["this is not valid json {{"], "broken.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [malformed] } });

    const error = await screen.findByTestId("import-error");
    expect(error).toBeInTheDocument();
    expect(error.textContent ?? "").toMatch(/json/i);
    // A malformed file never reaches the create mutations (no writes through the offline bridge).
    expect(client.mutation).not.toHaveBeenCalled();
  });
});
