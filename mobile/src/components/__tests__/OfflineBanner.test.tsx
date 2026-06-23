import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OfflineBanner } from "../OfflineBanner";

/**
 * Online-only social/groups/billing surfaces must surface a non-blocking offline banner when the
 * device is disconnected (PRODUCT_SPEC.md §5 REQ-082, §5 cross-cutting REQ-101). Mirrors the web
 * online-only behavior. Connectivity flows through the shared `offline/connectivity` flag, kept in
 * sync by `useOnlineStatus` listening to NetInfo (mocked here for jsdom).
 */

const h = vi.hoisted(() => ({
  state: { isConnected: true, isInternetReachable: true } as {
    isConnected: boolean;
    isInternetReachable: boolean | null;
  },
}));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: () => Promise.resolve(h.state),
    addEventListener: (cb: (state: typeof h.state) => void) => {
      cb(h.state);
      return () => {};
    },
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("OfflineBanner (REQ-082, REQ-101)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state = { isConnected: true, isInternetReachable: true };
  });

  afterEach(() => {
    cleanup();
  });

  it("should_show_offline_banner_on_online_only_surface_when_offline", () => {
    h.state = { isConnected: false, isInternetReachable: false };

    render(<OfflineBanner />);

    const banner = screen.getByRole("alert");
    expect(banner).toBeTruthy();
    expect(screen.getByText("offline.onlineOnlyBanner")).toBeTruthy();
    // Non-blocking: a retry affordance is always offered alongside the notice.
    expect(screen.getByText("offline.retry")).toBeTruthy();
  });

  it("should_hide_offline_banner_when_online", () => {
    h.state = { isConnected: true, isInternetReachable: true };

    render(<OfflineBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("offline.onlineOnlyBanner")).toBeNull();
  });
});
