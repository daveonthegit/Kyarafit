import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import {
  parseDataBundle,
  PORTABLE_COLLECTIONS,
  type PortableCollectionKey,
} from "@/lib/dataPortability";
import en from "../../../../messages/en.json";

// Spec: PRODUCT_SPEC.md §3/§4.9 — export is FREE (REQ-012). Web edits save straight to the account
// (ADR-0006), so Export fetches the account's server rows and merges the browser's retained local
// store (DATA_AND_SYNC.md §11); offline it exports the local store alone and says so. Backup-file
// restore is not offered on web and this page says so.

const client = {
  mutation: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  query: vi.fn<
    (
      ref: FunctionReference<"query">,
      args: { collection: PortableCollectionKey }
    ) => Promise<unknown>
  >(async () => []),
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
      exportPreparing: "Preparing export…",
      exportPreparingProgress: `Preparing export… ${values?.done}/${values?.total}`,
      accountExportNote: en.DataPortability.accountExportNote,
      localOnlyNotice: `You're offline, so the export includes only what this browser holds: ${values?.count ?? 0} item(s)`,
      exportedCount: `Exported ${values?.count ?? 0} item(s).`,
      exportFailed:
        "Couldn't load your data from your Kyarafit account, so nothing was downloaded.",
      loading: "Loading your data…",
      importTitle: "Import a backup",
      importInMobileApp: "Restoring a backup file is not available on the web.",
      webSavesOnline: "Changes you make on the web save to your Kyarafit account right away.",
      backToSettings: "Back to settings",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/** Server rows for an account with web-edited data the local store never saw. */
const serverRows: Partial<Record<PortableCollectionKey, Record<string, unknown>[]>> = {
  builds: [
    { _id: "srv-b1", userId: "user-free-1", name: "Cloud", status: "wip" },
    { _id: "shared-b", userId: "user-free-1", name: "Server copy", status: "done" },
  ],
  conventions: [{ _id: "srv-c1", userId: "user-free-1", name: "Anime Expo" }],
  packingListItems: [
    { _id: "srv-p1", userId: "user-free-1", conventionId: "srv-c1", label: "Wig" },
  ],
  cosplayNodes: [{ _id: "srv-n1", userId: "user-free-1", name: "Wig", tags: [] }],
  workflowItems: [{ _id: "srv-w1", title: "Style wig", notes: "Use heat protectant" }],
  workflowAttachments: [
    {
      _id: "srv-a1",
      workflowItemId: "srv-w1",
      entityType: "cosplayNode",
      entityId: "srv-n1",
      entityKey: "cosplayNode:srv-n1",
      role: "primary",
    },
  ],
  buildProgressUpdates: [
    {
      _id: "srv-progress",
      buildId: "srv-b1",
      note: "Wig styled",
      imageRefs: [{ kind: "url", url: "https://example.com/wig.jpg" }],
    },
  ],
};

function serveRows(rows: typeof serverRows) {
  client.query.mockImplementation(async (ref, { collection }) => {
    expect(getFunctionName(ref)).toBe("accountExport:listCollection");
    return rows[collection] ?? [];
  });
}

/** Capture the Blob handed to the browser download path. */
function captureDownloads() {
  const blobs: Blob[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:mock-url";
  });
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  return { blobs, createObjectURL, click };
}

function seedLocalBuild(id: string, name: string) {
  offlineRuntime.upsertSyncedEntityRow("builds", id, "user-free-1", {
    _id: id,
    userId: "user-free-1",
    name,
    status: "wip",
  });
}

describe("Settings data export page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serveRows({});
    rememberLocalAccount("user-free-1");
    offlineRuntime.setStore(new InMemoryLocalStore(), "user-free-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("explains that web edits save to the account and offers no file restore", () => {
    render(<SettingsDataPage />);
    expect(screen.getByTestId("import-unavailable")).toHaveTextContent(
      "Restoring a backup file is not available on the web."
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Changes you make on the web save to your Kyarafit account right away."
    );
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /backup file|restore/i })).not.toBeInTheDocument();
    expect(client.mutation).not.toHaveBeenCalled();
  });

  it("does not fetch account data until Export is clicked", () => {
    render(<SettingsDataPage />);
    expect(client.query).not.toHaveBeenCalled();
    expect(screen.getByTestId("export-source")).toHaveTextContent(
      en.DataPortability.accountExportNote
    );
  });

  it("should_export_a_downloadable_bundle_for_free_user", async () => {
    const { blobs, click } = captureDownloads();
    // A free user's build lives only in the local store (never synced to Convex).
    seedLocalBuild("b1", "Aerith");

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

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const parsed = parseDataBundle(await blobs[0].text());
    expect(parsed.builds.map((r) => r.id)).toContain("b1");
  });

  it("exports the account's server rows merged with retained local rows", async () => {
    const { blobs, click } = captureDownloads();
    serveRows(serverRows);
    seedLocalBuild("local-b1", "Offline draft");
    seedLocalBuild("shared-b", "Stale local copy");

    render(<SettingsDataPage />);
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const parsed = parseDataBundle(await blobs[0].text());

    expect(parsed.builds.map((r) => r.id).sort()).toEqual(["local-b1", "shared-b", "srv-b1"]);
    expect(parsed.builds.find((r) => r.id === "shared-b")?.name).toBe("Server copy");
    expect(parsed.conventions.map((r) => r.id)).toEqual(["srv-c1"]);
    expect(parsed.packingListItems.map((r) => r.id)).toEqual(["srv-p1"]);
    expect(parsed.cosplayNodes.map((r) => r.id)).toEqual(["srv-n1"]);
    expect(parsed.workflowItems).toEqual([
      { _id: "srv-w1", id: "srv-w1", title: "Style wig", notes: "Use heat protectant" },
    ]);
    expect(parsed.workflowAttachments).toEqual(
      serverRows.workflowAttachments!.map((row) => ({ ...row, id: row._id }))
    );
    expect(parsed.buildProgressUpdates).toEqual(
      serverRows.buildProgressUpdates!.map((row) => ({ ...row, id: row._id }))
    );
    expect(screen.getByText("Exported 9 item(s).")).toBeInTheDocument();
  });

  it("shows a busy button while the account data loads", async () => {
    const { blobs, click } = captureDownloads();
    const pending: Array<() => void> = [];
    client.query.mockImplementation((ref, { collection }) => {
      expect(getFunctionName(ref)).toBe("accountExport:listCollection");
      return new Promise((resolve) => pending.push(() => resolve(serverRows[collection] ?? [])));
    });

    render(<SettingsDataPage />);
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    const total = PORTABLE_COLLECTIONS.length;
    const busyButton = await screen.findByRole("button", { name: `Preparing export… 0/${total}` });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");

    expect(click).not.toHaveBeenCalled();
    await act(async () => pending.shift()!());
    const progressing = await screen.findByRole("button", { name: `Preparing export… 1/${total}` });
    expect(progressing).toBeDisabled();
    expect(progressing).toHaveAttribute("aria-busy", "true");
    expect(click).not.toHaveBeenCalled();
    while (pending.length) {
      const batch = pending.splice(0);
      await act(async () => batch.forEach((release) => release()));
    }
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const parsed = parseDataBundle(await blobs[0].text());
    expect(parsed.builds.map((row) => row.name)).toEqual(["Cloud", "Server copy"]);
    expect(screen.getByText("Exported 8 item(s).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export data/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /export data/i })).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  it("falls back to the local store when offline and says so", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const { blobs, click } = captureDownloads();
    seedLocalBuild("b1", "Aerith");

    render(<SettingsDataPage />);
    expect(screen.getByTestId("export-source")).toHaveTextContent(
      "You're offline, so the export includes only what this browser holds: 1 item(s)"
    );
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(client.query).not.toHaveBeenCalled();
    const parsed = parseDataBundle(await blobs[0].text());
    expect(parsed.builds.map((r) => r.id)).toEqual(["b1"]);
  });

  it("downloads the complete export after an unrelated theme storage change", async () => {
    const { blobs, click } = captureDownloads();
    seedLocalBuild("alice-private", "Alice private build");
    const pending: Array<() => void> = [];
    client.query.mockImplementation(
      (_ref, { collection }) =>
        new Promise((resolve) => {
          pending.push(() => resolve(serverRows[collection] ?? []));
        })
    );
    render(<SettingsDataPage />);
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));
    await act(async () => pending.shift()!());
    await act(async () => {
      window.localStorage.setItem("kyar-theme", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "kyar-theme",
          oldValue: "light",
          newValue: "dark",
          storageArea: window.localStorage,
        })
      );
    });
    expect(screen.getByRole("button", { name: /Preparing export/ })).toBeDisabled();
    while (pending.length) {
      const batch = pending.splice(0);
      await act(async () => batch.forEach((release) => release()));
    }
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const parsed = parseDataBundle(await blobs[0].text());
    expect(parsed.builds.map((row) => row.id)).toEqual(["srv-b1", "shared-b", "alice-private"]);
    expect(parsed.workflowItems).toEqual([
      { _id: "srv-w1", id: "srv-w1", title: "Style wig", notes: "Use heat protectant" },
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Exported 9 item(s).")).toBeInTheDocument();
  });

  it.each(["switch", "switch-back", "storage-switch", "storage-clear", "unmount"])(
    "discards an in-flight export on %s",
    async (change) => {
      const { blobs, click, createObjectURL } = captureDownloads();
      seedLocalBuild("alice-private", "Alice private build");
      const pending: Array<() => void> = [];
      client.query.mockImplementation(
        (_ref, { collection }) =>
          new Promise((resolve) => {
            pending.push(() => resolve(serverRows[collection] ?? []));
          })
      );
      const { unmount } = render(<SettingsDataPage />);
      fireEvent.click(screen.getByRole("button", { name: /export data/i }));
      await act(async () => pending.shift()!());
      const started = client.query.mock.calls.length;
      await act(async () => {
        if (change === "unmount") unmount();
        else if (change === "storage-switch" || change === "storage-clear") {
          const key = "kyarafit:last-signed-in-account";
          if (change === "storage-clear") window.localStorage.clear();
          else window.localStorage.setItem(key, "bob");
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: change === "storage-clear" ? null : key,
              oldValue: change === "storage-clear" ? null : "user-free-1",
              newValue: change === "storage-clear" ? null : "bob",
              storageArea: window.localStorage,
            })
          );
        } else {
          rememberLocalAccount(null);
          rememberLocalAccount("bob");
          if (change === "switch-back") rememberLocalAccount("user-free-1");
        }
      });
      await act(async () => pending.splice(0).forEach((release) => release()));
      expect(client.query).toHaveBeenCalledTimes(started);
      expect(blobs).toEqual([]);
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
    }
  );

  it("shows an alert and downloads nothing when the account data cannot be fetched", async () => {
    const { createObjectURL, click } = captureDownloads();
    client.query.mockImplementation(async (ref, { collection }) => {
      expect(getFunctionName(ref)).toBe("accountExport:listCollection");
      if (collection === "workflowItems") throw new Error("Server error");
      return serverRows[collection] ?? [];
    });
    seedLocalBuild("b1", "Aerith");

    render(<SettingsDataPage />);
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your data from your Kyarafit account, so nothing was downloaded."
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /export data/i })).toBeEnabled();
  });
});
