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

const state = vi.hoisted(() => ({
  identity: { subject: "owner" } as { subject: string } | null | undefined,
  vaultSubject: "owner" as string | null,
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
  deleteVault: vi.fn(),
  writeBackup: vi.fn(),
  deliverBackup: vi.fn(),
  discardBackup: vi.fn(),
  importBackup: vi.fn(),
  vaultRows: [] as { table: string; id: string; doc: Record<string, unknown> }[],
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
  useConvex: () => ({ query: vi.fn(async () => null) }),
  useQuery: (_query: unknown, args: unknown) => (args === "skip" ? undefined : state.identity),
}));
vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: { tier: state.tier, storageLimitMb: 50, currentUsageMb: 6.2 },
    isLoading: state.tierLoading,
  }),
}));
vi.mock("@/lib/auth/client", () => ({ signOut: state.signOut }));
vi.mock("@/vault/hooks", () => ({
  useActiveVault: () => ({ exportRows: () => state.vaultRows }),
  useVaultState: () =>
    state.vaultSubject
      ? { status: "unlocked", account: { subject: state.vaultSubject } }
      : { status: "locked" },
}));
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
vi.mock("@/offline", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    usePendingQueueCount: () => state.pending,
    // Identity comes from the vault hook too; every other read returns the fixture rows.
    useOfflineQuery: (query: never, args?: unknown) =>
      getFunctionName(query) === "auth:getCurrentUser"
        ? state.identity
        : args === "skip"
          ? undefined
          : state.rows,
    useOfflineMutation: () => state.create,
  };
});
vi.mock("@/offline/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/offline/db")>()),
  deleteVaultDatabase: state.deleteVault,
}));
vi.mock("@/vault/activeVault", () => {
  const vault = { exportRows: () => state.vaultRows };
  return {
    subscribeVault: () => () => {},
    getVaultDataVersion: () => 1,
    getActiveVault: () => vault,
    requireActiveVault: () => vault,
  };
});
vi.mock("@/vault/portabilityDevice", () => ({
  writeVaultBackup: state.writeBackup,
  deliverVaultBackup: state.deliverBackup,
  discardVaultBackup: state.discardBackup,
  pickAndImportVaultBackup: state.importBackup,
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
  state.vaultSubject = "owner";
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
  state.deleteVault.mockResolvedValue(undefined);
  state.vaultRows = [
    {
      table: "builds",
      id: "build-1",
      doc: { name: "Test build", imageUrl: "kyarafit-image:img_a" },
    },
    { table: "cosplayNodes", id: "node-1", doc: { name: "Wig" } },
    { table: "vaultSettings", id: "s-1", doc: { key: "focusedBuildId", value: "build-1" } },
  ];
  state.writeBackup.mockResolvedValue({
    uri: "file:///cache/backups/kyarafit-backup.kyarafit",
    summary: { rows: 3, images: 1, missingImages: [], rowsOmitted: 0, bytes: 100 },
  });
  state.deliverBackup.mockResolvedValue(true);
  state.importBackup.mockResolvedValue(null);
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
    expect(
      within(dialog).getByText(/locked until you sign in again with this account/)
    ).toBeTruthy();
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
    fireEvent.click(within(openSignOut()).getByRole("button", { name: "Save backup" }));
    expect(state.push).toHaveBeenCalledWith(APP_HREF.settingsData);
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it.each(["PRO", "SUPPORTER"])("confirms %s sign-out without the free export warning", (tier) => {
    state.tier = tier;
    render(<Settings />);
    const dialog = openSignOut();
    expect(within(dialog).getByText(/Are you sure/)).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Save backup" })).toBeNull();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("warns unknown tiers conservatively and keeps the upgrade link", () => {
    state.tier = "unknown";
    render(<Settings />);
    expect(screen.getByText("Upgrade for automatic cloud sync and backup.")).toBeTruthy();
    expect(
      within(openSignOut()).getByText(/locked until you sign in again with this account/)
    ).toBeTruthy();
  });

  it.each(["FREE", "PRO"])(
    "allows sign-out while offline plan information is unavailable (%s)",
    async (tier) => {
      state.tier = tier;
      state.tierLoading = true;
      state.connected = false;
      render(<Settings />);
      const dialog = openSignOut();
      expect(
        within(dialog).getByText(/locked until you sign in again with this account/)
      ).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Save backup" })).toBeTruthy();
      expect(state.signOut).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
      await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByTestId("modal")).toBeNull());
    }
  );

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

  it("shows what a backup will hold and saves it through the OS", async () => {
    render(<Data />);
    expect(screen.getByText("2 items · 1 photos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith(
        "Backup saved",
        "3 items and 1 photos are in your backup."
      )
    );
    expect(state.deliverBackup).toHaveBeenCalledWith(
      "file:///cache/backups/kyarafit-backup.kyarafit",
      "Back up"
    );
  });

  it("counts cloud-only originals referenced by local records", () => {
    state.vaultRows = [
      "builds",
      "cosplayNodes",
      "conventions",
      "buildReferenceImages",
      "buildProcessPictures",
    ].map((table, index) => ({
      table,
      id: `${index}`,
      doc: { imageStorageId: `cloud-${index}` },
    }));
    render(<Data />);
    expect(screen.getByText("5 items · 5 photos")).toBeTruthy();
  });

  it("reports photos that were missing at backup time", async () => {
    state.writeBackup.mockResolvedValue({
      uri: "file:///b.kyarafit",
      summary: { rows: 3, images: 0, missingImages: ["img_a"], rowsOmitted: 0, bytes: 10 },
    });
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await waitFor(() => expect(state.alert).toHaveBeenCalled());
    expect(state.alert.mock.calls[0][1]).toContain("1 photo originals were unavailable");
  });

  it("stays quiet when the user cancels the share sheet", async () => {
    state.deliverBackup.mockResolvedValue(false);
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await waitFor(() => expect(state.deliverBackup).toHaveBeenCalled());
    expect(state.alert).not.toHaveBeenCalled();
  });

  it("shows empty-backup feedback without writing a file", () => {
    state.vaultRows = [];
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    expect(state.alert).toHaveBeenCalledWith("Something went wrong", en.settings.dataExportEmpty);
    expect(state.writeBackup).not.toHaveBeenCalled();
  });

  it("restores a picked backup and summarizes what changed", async () => {
    state.importBackup.mockResolvedValue({
      rows: { inserted: 4, updated: 1, skipped: 2, unknown: 0, conflicts: 0 },
      rowsOmitted: 0,
      photosWritten: 2,
      photosAlreadyPresent: 0,
      photosMissing: [],
    });
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Choose backup" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith(
        "Backup restored",
        "4 added, 1 updated, 2 already up to date."
      )
    );
  });

  it("flags a partial restore when photos could not be restored", async () => {
    state.importBackup.mockResolvedValue({
      rows: { inserted: 1, updated: 0, skipped: 0, unknown: 0, conflicts: 0 },
      rowsOmitted: 0,
      photosWritten: 0,
      photosAlreadyPresent: 0,
      photosMissing: ["img_x", "img_y"],
    });
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Choose backup" }));
    await waitFor(() => expect(state.alert).toHaveBeenCalled());
    expect(state.alert.mock.calls[0][0]).toBe(en.settings.dataImportPartialTitle);
    expect(state.alert.mock.calls[0][1]).toContain(
      "2 photos from this backup couldn't be restored."
    );
  });

  it("reports unreadable backup rows with a partial title and omission count", async () => {
    state.writeBackup.mockResolvedValue({ uri: "file:///b.kyarafit",
      summary: { rows: 3, images: 0, missingImages: [], rowsOmitted: 2, bytes: 10 },
    });
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await waitFor(() => expect(state.alert).toHaveBeenCalled());
    expect(state.alert.mock.calls[0][0]).toBe(en.settings.dataExportPartialTitle);
    expect(state.alert.mock.calls[0][1]).toContain("2 unreadable items");
  });

  it.each(["omissions", "conflicts"])("reports restore %s without claiming full success", async (kind) => {
    state.importBackup.mockResolvedValue({
      rows: { inserted: 0, updated: 0, skipped: 0, unknown: kind === "omissions" ? 2 : 0,
        conflicts: kind === "conflicts" ? 2 : 0 },
      rowsOmitted: kind === "omissions" ? 2 : 0,
      photosWritten: 0, photosAlreadyPresent: 0, photosMissing: [],
    });
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Choose backup" }));
    await waitFor(() => expect(state.alert).toHaveBeenCalled());
    expect(state.alert.mock.calls[0][0]).toBe(en.settings.dataImportPartialTitle);
    expect(state.alert.mock.calls[0][1]).toContain(kind === "omissions"
      ? "2 items were omitted" : "2 conflicting parent changes");
  });

  it("surfaces a damaged backup instead of claiming success", async () => {
    state.importBackup.mockRejectedValue(new Error("This Kyarafit backup is damaged"));
    render(<Data />);
    fireEvent.click(screen.getByRole("button", { name: "Choose backup" }));
    await waitFor(() =>
      expect(state.alert).toHaveBeenCalledWith(
        "Something went wrong",
        "This Kyarafit backup is damaged"
      )
    );
  });

  it.each([undefined, null])(
    "removes device data without remote identity (%s) after confirmation",
    async (identity) => {
      state.identity = identity;
      render(<Data />);
      expect(screen.queryByText("Loading data")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Remove device data" }));
      expect(state.deleteVault).not.toHaveBeenCalled();
      const [title, , buttons] = state.alert.mock.calls[0] as [
        string,
        string,
        { text: string; style?: string; onPress?: () => void }[],
      ];
      expect(title).toBe(en.settings.dataRemoveConfirmTitle);
      expect(buttons.find((b) => b.style === "cancel")).toBeTruthy();
      buttons.find((b) => b.style === "destructive")?.onPress?.();
      await waitFor(() => expect(state.deleteVault).toHaveBeenCalledWith("owner"));
      // Locks (signs out) before deleting the closed vault files.
      expect(state.signOut.mock.invocationCallOrder[0]).toBeLessThan(
        state.deleteVault.mock.invocationCallOrder[0]
      );
    }
  );
});
