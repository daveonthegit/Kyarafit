import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { setOfflineConnectivity } from "@/lib/offline/connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import {
  buildDataBundle,
  emptyCollections,
  parseDataBundle,
  runImport,
  summarizeTotals,
  type CreateRowFn,
  type PortableCollections,
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
    client.query.mockReset().mockResolvedValue(null);
    rememberLocalAccount("user-free-1");
    offlineRuntime.setStore(new InMemoryLocalStore(), "user-free-1");
  });

  afterEach(() => {
    setOfflineConnectivity(true);
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
    client.mutation.mockImplementation(async (_fn, args) => {
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
      workflowItems: [{ id: "task", title: "Task", attachments: [
        { entityType: "cosplayNode", entityId: "child", role: "primary", buildContextId: "build" },
      ] }],
    });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("Imported 4");
    expect(client.mutation.mock.calls.map(([fn]) => getFunctionName(fn as never))).toEqual([
      "builds:create", "cosplayNodes:create", "builds:addNodesToBuild",
      "cosplayNodes:create", "cosplayNodes:addChildLink", "workflow:create",
    ]);
    expect(client.mutation.mock.calls[2][1]).toMatchObject({ buildId: "restored:Build", cosplayNodeIds: ["restored:Root"] });
    expect(client.mutation.mock.calls[4][1]).toMatchObject({ parentNodeId: "restored:Root", childNodeId: "restored:Child" });
    expect(client.mutation.mock.calls[5][1]).toMatchObject({ attachments: [
      { entityType: "cosplayNode", entityId: "restored:Child", role: "primary", buildContextId: "restored:Build" },
    ] });
  });

  it.each([
    { nodeType: "element", purchaseStatus: "to_buy", operation: "buy" },
    { nodeType: "element", buildStatus: "wip", operation: "wip" },
    { nodeType: "material", materialStatus: "to_buy", operation: "buy" },
    { nodeType: "material", materialStatus: "in_use", operation: "wip" },
  ])("reuses generated tasks and durable import identities for $nodeType/$operation", async (state) => {
    setOfflineConnectivity(true);
    const nodes: string[] = [];
    const linked = new Set<string>();
    const tasks: { _id: string; dedupeKey?: string; status?: string; parentId?: string; attachments?: unknown }[] = [];
    client.mutation.mockImplementation(async (fn, raw) => {
      const name = getFunctionName(fn as never);
      const args = raw as Record<string, unknown>;
      if (name === "builds:create") return { _id: "restored-build" };
      if (name === "cosplayNodes:create") {
        expect(args).not.toHaveProperty("idempotencyKey");
        const id = `node-${nodes.length + 1}`;
        nodes.push(id);
        tasks.push({ _id: `generated-${id}`, dedupeKey: `autogen:${state.operation}:shared:${id}` });
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
      return { shared: tasks.filter((task) => task.dedupeKey?.endsWith(`:${cosplayNodeId}`)), buildSpecific: [] };
    });
    const { operation, ...fields } = state;
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "source-build", name: "Build" }],
      cosplayNodes: [{ id: "source-node", name: "Wig", buildId: "source-build", ...fields }],
      workflowItems: [
        { id: "source-group", title: "Group", kind: "group" },
        { id: "source-generated", title: "Restored task", parentId: "source-group", status: "done",
          dedupeKey: `autogen:${operation}:shared:source-node`,
          attachments: [{ entityType: "cosplayNode", entityId: "source-node", role: "progress_source", buildContextId: "source-build" }] },
      ],
    });
    const file = new File([bundle], "generated.json", { type: "application/json" });
    const first = render(<SettingsDataPage />);
    fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId("import-summary")).toHaveTextContent("Imported 4"));
    expect(nodes).toEqual(["node-1"]);
    expect(linked).toEqual(new Set(["restored-build:node-1"]));
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ _id: "generated-node-1", status: "done", parentId: "task-2",
      attachments: [{ entityId: "node-1", buildContextId: "restored-build" }] });
    first.unmount();
    const store = offlineRuntime.getStore();
    offlineRuntime.lock();
    offlineRuntime.setStore(store, "user-free-1");
    render(<SettingsDataPage />);
    fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId("import-summary")).toHaveTextContent("Imported 0"));
    expect(nodes).toEqual(["node-1"]);
    expect(linked).toEqual(new Set(["restored-build:node-1"]));
    expect(tasks).toHaveLength(2);
  });

  it.each(["root", "child"])("reuses a created element after its %s attachment fails", async (failedLink) => {
    setOfflineConnectivity(true);
    const nodes: string[] = [];
    const links = new Set<string>();
    let failed = false;
    client.mutation.mockImplementation(async (fn, raw) => {
      const name = getFunctionName(fn as never);
      const args = raw as Record<string, unknown>;
      if (name === "builds:create") return { _id: "destination-build" };
      if (name === "cosplayNodes:create") {
        const id = String(args.name);
        nodes.push(id);
        return { _id: id };
      }
      const child = name === "cosplayNodes:addChildLink";
      if (!failed && child === (failedLink === "child")) {
        failed = true;
        throw new Error("Attachment failed");
      }
      links.add(child
        ? `${args.parentNodeId}:${args.childNodeId}`
        : `${args.buildId}:${(args.cosplayNodeIds as string[])[0]}`);
    });
    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [{ id: "build" }],
      cosplayNodes: [
        { id: "source-root", name: "destination-root", nodeType: "element", buildId: "build" },
        ...(failedLink === "child" ? [{ id: "source-child", name: "destination-child", nodeType: "element", parentNodeId: "source-root" }] : []),
      ],
    });
    render(<SettingsDataPage />);
    const file = new File([bundle], "retry.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
    await screen.findByTestId("import-error");
    fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } });
    await screen.findByTestId("import-summary");
    expect(nodes).toEqual(failedLink === "child" ? ["destination-root", "destination-child"] : ["destination-root"]);
    expect(links.has("destination-build:destination-root")).toBe(true);
    if (failedLink === "child") expect(links.has("destination-root:destination-child")).toBe(true);
  });

  it("reports an unsupported offline element restore before enqueuing anything", async () => {
    setOfflineConnectivity(false);
    render(<SettingsDataPage />);
    const bundle = buildDataBundle({
      ...emptyCollections(), builds: [{ id: "build" }],
      cosplayNodes: [{ id: "node", nodeType: "element" }],
    });
    fireEvent.change(screen.getByTestId("import-file-input"), {
      target: { files: [new File([bundle], "backup.json", { type: "application/json" })] },
    });
    expect(await screen.findByTestId("import-error")).toHaveTextContent("while online");
    expect(client.mutation).not.toHaveBeenCalled();
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
  });

  it("should_not_duplicate_rows_on_reimport", async () => {
    // Drive the import orchestration twice with the same bundle against an accumulating store.
    const store: PortableCollections = {
      ...emptyCollections(),
      builds: [{ _id: "b1", id: "b1", name: "Aerith", status: "wip" }],
    };
    const created: string[] = [];
    const createRow: CreateRowFn = (collection, row) => {
      store[collection].push(row);
      created.push(`${collection}:${row.id}`);
      return row.id;
    };

    const bundle = buildDataBundle({
      ...emptyCollections(),
      builds: [
        { id: "b1", name: "Aerith", status: "wip" },
        { id: "b2", name: "Cloud", status: "idea" },
      ],
    });
    const imported = parseDataBundle(bundle);

    const first = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(first)).toEqual({ added: 1, skipped: 1 });
    expect(created).toEqual(["builds:b2"]);

    // Second import with the same bundle: the already-present id b2 is NOT created again.
    const second = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(second)).toEqual({ added: 0, skipped: 2 });
    expect(created).toEqual(["builds:b2"]);
  });

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
