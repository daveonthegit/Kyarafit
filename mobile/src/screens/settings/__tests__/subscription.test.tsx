import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import en from "@/i18n/locales/en.json";
import SubscriptionScreen from "../../../../app/(app)/settings/subscription";

const h = vi.hoisted(() => ({
  identity: { subject: "fixture-owner" } as { subject: string } | null | undefined,
  tier: "FREE",
  native: true,
  paid: false,
  getOfferings: vi.fn(),
  info: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
  paywall: vi.fn(),
  center: vi.fn(),
  listener: vi.fn(),
  removeListener: vi.fn(),
  webPath: vi.fn(),
  cancelled: false,
  packages: [
    {
      identifier: "monthly-fixture",
      product: { identifier: "com.kyarafit.pro.monthly", priceString: "$3.00" },
    },
    {
      identifier: "annual-fixture",
      product: { identifier: "com.kyarafit.pro.annual", priceString: "$30.00" },
    },
    {
      identifier: "supporter-fixture",
      product: { identifier: "com.kyarafit.supporter.m5", priceString: "$5.00" },
    },
  ],
}));
const i18n = createInstance();
void i18n.init({ lng: "en", resources: { en: { translation: en } }, initAsync: false });
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: i18n.t.bind(i18n) }) }));
vi.mock("react-native", async () =>
  (await import("@/test-support/rnMock")).createReactNativeMock()
);
vi.mock("expo-router", () => ({ Stack: { Screen: () => null } }));
vi.mock("convex/_generated/api", () => ({
  api: { auth: { getCurrentUser: "identity" }, files: { getUrl: "fileUrl" } },
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) => (ref === "identity" ? h.identity : null),
}));
vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: { tier: h.tier, currentUsageMb: 12, storageLimitMb: 50 },
    isLoading: false,
  }),
}));
vi.mock("react-native-purchases", () => ({ default: { getOfferings: h.getOfferings } }));
vi.mock("@/lib/revenuecat", () => ({
  isRevenueCatSupportedPlatform: () => h.native,
  ensureRevenueCatConfigured: () => {},
  getRevenueCatCustomerInfo: h.info,
  customerHasPaidEntitlement: () => h.paid,
  addRevenueCatCustomerInfoUpdateListener: (fn: unknown) => {
    h.listener(fn);
    return h.removeListener;
  },
  purchaseRevenueCatPackage: h.purchase,
  restoreRevenueCatPurchases: h.restore,
  presentProPaywallIfNeeded: h.paywall,
  presentRevenueCatCustomerCenter: h.center,
  didRevenueCatPaywallUnlockEntitlement: (result: string) => result === "PURCHASED",
  isRevenueCatPurchaseCancelled: () => h.cancelled,
}));
vi.mock("@/lib/openWebAppPath", () => ({ openWebAppPath: h.webPath }));
vi.mock("@/ui", () => ({
  DataBoundary: ({
    status,
    loading,
    data,
    children,
  }: {
    status: string;
    loading: React.ReactNode;
    data: unknown;
    children: (data: unknown) => React.ReactNode;
  }) => (status === "loading" ? loading : children(data)),
}));

async function openSubscription() {
  render(<SubscriptionScreen />);
  await screen.findByRole("button", { name: "$3.00 / month" });
}

describe("Glass subscription actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.identity = { subject: "fixture-owner" };
    h.tier = "FREE";
    h.native = true;
    h.paid = false;
    h.cancelled = false;
    h.getOfferings.mockResolvedValue({ current: { availablePackages: h.packages } });
    h.info.mockResolvedValue({});
    h.purchase.mockResolvedValue({ customerInfo: {} });
    h.restore.mockResolvedValue({});
    h.paywall.mockResolvedValue("PURCHASED");
    h.center.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("shows all existing plans and the current plan without changing entitlements", async () => {
    await openSubscription();
    expect(screen.getByText("Kyarafit Pro")).toBeTruthy();
    expect(screen.getByText("Kyarafit Supporter")).toBeTruthy();
    expect(screen.getAllByText(en.settings.subscriptionCurrent)).toHaveLength(1);
    expect(screen.getByRole("progressbar").getAttribute("aria-label")).toBe(
      en.settings.backupStorage
    );
  });
  it.each([
    ["$3.00 / month", 0],
    ["$30.00 / year", 1],
    ["$5.00", 2],
  ] as const)("purchases the unchanged package for %s", async (label, index) => {
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(h.purchase).toHaveBeenCalledWith(h.packages[index]));
    await screen.findByText(en.settings.subscriptionPurchaseSuccess);
  });
  it("prevents concurrent purchase and restore while the store is busy", async () => {
    let finish: (value: { customerInfo: object }) => void = () => {};
    h.purchase.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "$3.00 / month" }));
    fireEvent.click(screen.getByRole("button", { name: en.settings.subscriptionRestore }));
    fireEvent.click(screen.getByRole("button", { name: "$30.00 / year" }));
    expect(h.purchase).toHaveBeenCalledOnce();
    expect(h.restore).not.toHaveBeenCalled();
    finish({ customerInfo: {} });
    await screen.findByText(en.settings.subscriptionPurchaseSuccess);
  });
  it("silently handles purchase cancellation but reports other failures", async () => {
    h.purchase.mockRejectedValue(new Error("Fixture purchase failure"));
    h.cancelled = true;
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "$3.00 / month" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Opening..." })).toBeNull());
    expect(screen.queryByText(en.settings.subscriptionError)).toBeNull();
    h.cancelled = false;
    fireEvent.click(screen.getByRole("button", { name: "$3.00 / month" }));
    await screen.findByText(en.settings.subscriptionError);
  });
  it("restores through the existing store adapter and reports restore failure", async () => {
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: en.settings.subscriptionRestore }));
    await screen.findByText(en.settings.subscriptionRestoreSuccess);
    expect(h.restore).toHaveBeenCalledOnce();
    h.restore.mockRejectedValue(new Error("Fixture restore failure"));
    fireEvent.click(screen.getByRole("button", { name: en.settings.subscriptionRestore }));
    await screen.findByText(en.settings.subscriptionRestoreError);
  });
  it("does not open a paywall for an already-paid customer", async () => {
    h.paid = true;
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "Open Paywall" }));
    await screen.findByText("Your subscription is already active.");
    expect(h.paywall).not.toHaveBeenCalled();
  });
  it("refreshes customer info after the paywall and cleans up its listener", async () => {
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "Open Paywall" }));
    await screen.findByText(
      "RevenueCat paywall finished. Your Pro access is active or already unlocked."
    );
    expect(h.paywall).toHaveBeenCalledOnce();
    expect(h.info).toHaveBeenCalledTimes(2);
    cleanup();
    expect(h.removeListener).toHaveBeenCalledOnce();
  });
  it("keeps customer center restore callbacks", async () => {
    h.center.mockImplementation(async ({ onRestoreCompleted }) =>
      onRestoreCompleted({ customerInfo: {} })
    );
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "Customer Center" }));
    await screen.findByText(en.settings.subscriptionRestoreSuccess);
    expect(h.center.mock.calls[0][0].onRestoreFailed).toBeTypeOf("function");
  });
  it("disables current-plan, missing-product, and unsigned-in purchases", async () => {
    h.tier = "PRO";
    h.identity = null;
    await openSubscription();
    fireEvent.click(screen.getByRole("button", { name: "$3.00 / month" }));
    fireEvent.click(screen.getByRole("button", { name: "$5.00" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Not configured" })[0]);
    expect(h.purchase).not.toHaveBeenCalled();
  });
  it("supports unavailable-platform and empty-offering states", async () => {
    h.native = false;
    render(<SubscriptionScreen />);
    expect(screen.getByText(en.settings.subscriptionUnavailable)).toBeTruthy();
    expect(h.getOfferings).not.toHaveBeenCalled();
    cleanup();
    h.native = true;
    h.getOfferings.mockResolvedValue({ current: null });
    render(<SubscriptionScreen />);
    await screen.findByText(en.settings.subscriptionNoOfferings);
  });
});
