import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReactNativeMock } from "@/test-support/rnMock";
import en from "@/i18n/locales/en.json";
import Settings from "../../../../app/(app)/settings/index";
import Notifications from "../../../../app/(app)/settings/notifications";
import Offline from "../../../../app/(app)/settings/offline";
import Data from "../../../../app/(app)/settings/data";
import { APP_HREF } from "@/lib/appRoutes";
import { buildExport } from "@/lib/dataPortability";

const state = vi.hoisted(() => ({
  identity: { subject: "owner" } as { subject: string } | null | undefined,
  tier: "FREE",
  tierLoading: false,
  connected: true,
  pending: 3,
  rows: [{ _id: "build-1", userId: "owner", name: "Test build", status: "idea" }] as Record<
    string,
    unknown
  >[],
  netListener: null as
    ((value: { isConnected: boolean; isInternetReachable: boolean }) => void) | null,
  unsubscribe: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  setLocale: vi.fn(),
  openWeb: vi.fn(),
  write: vi.fn(),
  read: vi.fn(),
  fileInfo: vi.fn(),
  share: vi.fn(),
  alert: vi.fn(),
  create: vi.fn(),
}));

vi.mock("react-native", async () => ({
  ...(await createReactNativeMock()),
  Share: { share: state.share },
  Alert: { alert: state.alert },
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: state.push }),
  Link: ({
    children,
    href,
  }: {
    children: React.ReactElement<{ onPress: () => void }>;
    href: string;
  }) => React.cloneElement(children, { onPress: () => state.push(href) }),
}));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : state.identity),
}));
vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: { tier: state.tier, storageLimitMb: 50, currentUsageMb: 6.2 },
    isLoading: state.tierLoading,
  }),
}));
vi.mock("@/lib/auth/client", () => ({ signOut: state.signOut }));
vi.mock("@/lib/openWebAppPath", () => ({ openWebAppPath: state.openWeb }));
vi.mock("@/i18n", () => ({ SUPPORTED_LOCALES: ["en", "ja", "es"], setAppLocale: state.setLocale }));
vi.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => {
    const [preference, setPreference] = React.useState("system");
    return { preference, setPreference };
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, options?: Record<string, unknown>) => {
      const value = key
        .split(".")
        .reduce<unknown>(
          (obj, part) => (obj && typeof obj === "object" ? Reflect.get(obj, part) : undefined),
          en
        );
      const text = typeof value === "string" ? value : String(options?.defaultValue ?? key);
      return text.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ""));
    },
  }),
}));
vi.mock("@/ui", () => ({
  DataBoundary: ({ status, children }: { status: string; children: () => React.ReactNode }) =>
    status === "loading" ? <div>Loading data</div> : children(),
}));
vi.mock("@/offline", () => ({
  usePendingQueueCount: () => state.pending,
  useOfflineQuery: () => state.rows,
  useOfflineMutation: () => state.create,
}));
vi.mock("@/components/settings/SyncStatusSection", () => ({
  SyncStatusSection: ({ offline }: { offline: boolean }) => (
    <div data-testid="sync-section">Sync {offline ? "offline" : "online"}</div>
  ),
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: (callback: NonNullable<typeof state.netListener>) => {
      state.netListener = callback;
      callback({ isConnected: state.connected, isInternetReachable: state.connected });
      return state.unsubscribe;
    },
  },
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/documents/",
  writeAsStringAsync: state.write,
  readAsStringAsync: state.read,
  getInfoAsync: state.fileInfo,
}));

beforeEach(() => {
  vi.stubGlobal("__DEV__", false);
  vi.clearAllMocks();
  state.identity = { subject: "owner" };
  state.tier = "FREE";
  state.tierLoading = false;
  state.connected = true;
  state.pending = 3;
  state.rows = [{ _id: "build-1", userId: "owner", name: "Test build", status: "idea" }];
  state.signOut.mockResolvedValue(undefined);
  state.setLocale.mockResolvedValue(undefined);
  state.write.mockResolvedValue(undefined);
  state.share.mockResolvedValue(undefined);
  state.fileInfo.mockResolvedValue({ exists: false });
  state.create.mockResolvedValue("new-id");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function openSignOut() {
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  return screen.getByTestId("modal");
}

describe("settings confirmation and controls", () => {
  it("requires confirmation and warns free users about export before sign-out (REQ-031)", async () => {
    render(<Settings />);
    const dialog = openSignOut();
    expect(state.signOut).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/another account signing in/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
  });

  it("cancels without signing out", async () => {
    render(<Settings />);
    const dialog = openSignOut();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Cancel" }).at(-1)!);
    await waitFor(() => expect(screen.queryByTestId("modal")).toBeNull());
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("routes Export data to data management without clearing the session", () => {
    render(<Settings />);
    fireEvent.click(within(openSignOut()).getByRole("button", { name: "Export data" }));
    expect(state.push).toHaveBeenCalledWith(APP_HREF.settingsData);
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it.each(["PRO", "SUPPORTER"])("confirms %s sign-out without the free export warning", (tier) => {
    state.tier = tier;
    render(<Settings />);
    const dialog = openSignOut();
    expect(within(dialog).getByText(/Are you sure/)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Export data" })).toBeNull();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("warns unknown tiers conservatively and keeps the upgrade link", () => {
    state.tier = "unknown";
    render(<Settings />);
    expect(screen.getByText("Upgrade for automatic cloud sync and backup.")).toBeTruthy();
    expect(within(openSignOut()).getByText(/another account signing in/)).toBeTruthy();
  });

  it("disables sign-out until plan state is known", () => {
    state.tierLoading = true;
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.queryByTestId("modal")).toBeNull();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("retains confirmation after sign-out fails and allows retry", async () => {
    state.signOut.mockRejectedValueOnce(new Error("failure"));
    render(<Settings />);
    const dialog = openSignOut();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(state.alert).toHaveBeenCalled());
    expect(screen.getByTestId("modal")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(2));
  });

  it("does not submit twice while sign-out is in flight", async () => {
    let finish!: () => void;
    state.signOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    render(<Settings />);
    const confirm = within(openSignOut()).getByRole("button", { name: "Sign out" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(state.signOut).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it("keeps appearance, locale selection, routes, and policy links", () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "JA" }));
    expect(state.setLocale).toHaveBeenCalledWith("ja");
    fireEvent.click(screen.getByRole("link", { name: "Offline capability" }));
    expect(state.push).toHaveBeenCalledWith(APP_HREF.settingsOffline);
    fireEvent.click(screen.getByRole("link", { name: "Terms of Service" }));
    expect(state.openWeb).toHaveBeenCalledWith("/terms", expect.any(Function));
    fireEvent.click(screen.getByRole("link", { name: "Privacy policy" }));
    expect(state.openWeb).toHaveBeenCalledWith("/privacy", expect.any(Function));
  });

  it("keeps the identity loading boundary", () => {
    state.identity = undefined;
    render(<Settings />);
    expect(screen.getByText("Loading data")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});

describe("small settings screens", () => {
  it("does not invent notification controls for the existing placeholder", () => {
    render(<Notifications />);
    expect(screen.getByText(en.settings.notificationsSoonTitle)).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("keeps cloud-sync placement between connection and pending changes and cleans up NetInfo", () => {
    const view = render(<Offline />);
    const sync = screen.getByTestId("sync-section");
    expect(
      screen.getByText("Online").compareDocumentPosition(sync) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      sync.compareDocumentPosition(screen.getByText("Pending changes")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    act(() => state.netListener?.({ isConnected: true, isInternetReachable: false }));
    expect(screen.getByText("Offline")).toBeTruthy();
    expect(sync.textContent).toBe("Sync offline");
    view.unmount();
    expect(state.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("exports local rows to the known JSON file and OS share sheet", async () => {
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    await waitFor(() => expect(state.share).toHaveBeenCalled());
    expect(state.write).toHaveBeenCalledWith("/documents/kyarafit-export.json", expect.any(String));
    expect(state.alert).toHaveBeenCalledWith("Export ready", expect.any(String));
  });

  it("imports the saved export without duplicating existing rows", async () => {
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    await waitFor(() => expect(state.write).toHaveBeenCalled());
    state.fileInfo.mockResolvedValue({ exists: true });
    state.read.mockResolvedValue(state.write.mock.calls[0][1]);
    fireEvent.click(screen.getByRole("button", { name: "Import data" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith("Import complete", expect.any(String))
    );
    expect(state.create).not.toHaveBeenCalled();
  });

  it("imports new builds, elements, and conventions through the existing offline mutations", async () => {
    state.fileInfo.mockResolvedValue({ exists: true });
    state.read.mockResolvedValue(
      buildExport({
        builds: [{ _id: "new-build", userId: "owner", name: "Imported build", status: "planning" }],
        elements: [
          {
            _id: "new-element",
            userId: "owner",
            name: "Imported element",
            nodeType: "element",
            tags: ["fabric"],
          },
        ],
        conventions: [
          {
            _id: "new-convention",
            userId: "owner",
            name: "Imported convention",
            startDate: "2026-11-01",
            endDate: "2026-11-02",
          },
        ],
      })
    );
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Import data" }));
    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(3));
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "owner", name: "Imported build", status: "planning" })
    );
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "owner", name: "Imported element", tags: ["fabric"] })
    );
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner",
        name: "Imported convention",
        startDate: "2026-11-01",
        endDate: "2026-11-02",
      })
    );
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith(
        "Import complete",
        "Added 3 item(s); 0 already existed."
      )
    );
  });

  it("rejects malformed imports without creating rows", async () => {
    state.fileInfo.mockResolvedValue({ exists: true });
    state.read.mockResolvedValue("not-json");
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Import data" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith(
        "Something went wrong",
        en.settings.dataImportMalformed
      )
    );
    expect(state.create).not.toHaveBeenCalled();
  });

  it("keeps export success when the user dismisses the share sheet", async () => {
    state.share.mockRejectedValueOnce(new Error("dismissed"));
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith("Export ready", expect.any(String))
    );
    expect(state.write).toHaveBeenCalledTimes(1);
  });

  it("shows empty-export feedback before opening the share sheet", () => {
    state.rows = [];
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    expect(state.alert).toHaveBeenCalledWith("Something went wrong", en.settings.dataExportEmpty);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.share).not.toHaveBeenCalled();
  });

  it("shows missing-file feedback without creating data", async () => {
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Import data" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith("Something went wrong", en.settings.dataImportNoFile)
    );
    expect(state.create).not.toHaveBeenCalled();
  });

  it("keeps export and import free but requires a signed-in owner", () => {
    state.identity = null;
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Export data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import data" }));
    expect(state.alert).toHaveBeenCalledTimes(2);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });
});
