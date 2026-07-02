import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { setOfflineConnectivity } from "@/lib/offline/connectivity";
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

const client = { mutation: vi.fn(() => Promise.resolve(null)) };

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
    offlineRuntime.setStore(new InMemoryLocalStore());
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
