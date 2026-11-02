import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { parseDataBundle } from "@/lib/dataPortability";

// Spec: PRODUCT_SPEC.md §3/§4.9 — export is FREE (REQ-012). Web edits save straight to the account
// (ADR-0006), so Export fetches the account's server rows and merges the browser's retained local
// store (DATA_AND_SYNC.md §11); offline it exports the local store alone and says so. Backup-file
// restore is not offered on web and this page says so.

const client = {
  mutation: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  query: vi.fn<(ref: FunctionReference<"query">, args?: unknown) => Promise<unknown>>(
    async () => null
  ),
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
      accountExportNote: "Includes everything saved to your Kyarafit account",
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
const serverRows: Record<string, unknown> = {
  "builds:list": [
    { _id: "srv-b1", userId: "user-free-1", name: "Cloud", status: "wip", tasksTotal: 0 },
    { _id: "shared-b", userId: "user-free-1", name: "Server copy", status: "done" },
  ],
  "workflow:listBuildTree": { items: [] },
  "conventions:list": [{ _id: "srv-c1", userId: "user-free-1", name: "Anime Expo" }],
  "conventions:getPacking": [
    { _id: "srv-p1", userId: "user-free-1", conventionId: "srv-c1", label: "Wig" },
  ],
  "cosplayNodes:list": [{ _id: "srv-n1", userId: "user-free-1", name: "Wig", tags: [] }],
  "workflow:listPlanner": [{ _id: "srv-w1", title: "Style wig", cosplayNodeId: "srv-n1" }],
};

function serveRows(rows: Record<string, unknown>) {
  client.query.mockImplementation(async (ref) => rows[getFunctionName(ref)] ?? null);
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
    client.query.mockImplementation(async () => null);
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
      "Includes everything saved to your Kyarafit account"
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
      expect.objectContaining({
        id: "srv-w1",
        attachments: [{ entityType: "cosplayNode", entityId: "srv-n1" }],
      }),
    ]);
    expect(screen.getByText("Exported 7 item(s).")).toBeInTheDocument();
  });

  it("shows a busy button while the account data loads", async () => {
    const { click } = captureDownloads();
    // Account-wide lists answer at once; per-build / per-convention queries wait to be released.
    const pending: Array<() => void> = [];
    client.query.mockImplementation((ref) => {
      const name = getFunctionName(ref);
      const value = serverRows[name] ?? null;
      if (name !== "workflow:listBuildTree" && name !== "conventions:getPacking") {
        return Promise.resolve(value);
      }
      return new Promise((resolve) => pending.push(() => resolve(value)));
    });

    render(<SettingsDataPage />);
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    // Two builds and one convention: three per-row queries.
    const busyButton = await screen.findByRole("button", { name: "Preparing export… 0/3" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");

    pending.shift()?.();
    expect(
      await screen.findByRole("button", { name: "Preparing export… 1/3" })
    ).toBeInTheDocument();
    pending.forEach((release) => release());
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /export data/i })).toBeEnabled();
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

  it("shows an alert and downloads nothing when the account data cannot be fetched", async () => {
    const { createObjectURL, click } = captureDownloads();
    client.query.mockImplementation(async () => {
      throw new Error("Server error");
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
