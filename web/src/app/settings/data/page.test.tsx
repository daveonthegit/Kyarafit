import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsDataPage from "./page";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { setOfflineConnectivity } from "@/lib/offline/connectivity";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { parseDataBundle } from "@/lib/dataPortability";

// Spec: PRODUCT_SPEC.md §3/§4.9 — export is FREE (REQ-012) and sourced from the LOCAL STORE
// (DATA_AND_SYNC.md §11 REQ-D100, invariant #2). Web shows published copies only (ADR-0005), so it
// never writes personal data: restore lives in the mobile app and this page says so.

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
      importInMobileApp: "Backups are restored in the Kyarafit mobile app.",
      publishedReadOnly: "Web shows published copies only.",
      backToSettings: "Back to settings",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Settings data export page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rememberLocalAccount("user-free-1");
    offlineRuntime.setStore(new InMemoryLocalStore(), "user-free-1");
  });

  afterEach(() => {
    setOfflineConnectivity(true);
    vi.unstubAllGlobals();
  });

  it("points restore to the mobile app instead of writing personal data", () => {
    render(<SettingsDataPage />);
    expect(screen.getByTestId("import-unavailable")).toHaveTextContent(
      "Backups are restored in the Kyarafit mobile app."
    );
    expect(screen.getByRole("status")).toHaveTextContent("Web shows published copies only.");
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /backup file|restore/i })).not.toBeInTheDocument();
    expect(client.mutation).not.toHaveBeenCalled();
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
});
