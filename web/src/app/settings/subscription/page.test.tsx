import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsSubscriptionPage from "./page";

vi.mock("@/lib/api/useTier", () => ({
  useTier: vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    userId: "test-user-id",
    isLoading: false,
    isAuthenticated: true,
    identity: { subject: "test-user-id" },
  }),
}));

vi.mock("@/components/settings/WebSubscriptionRevenueCat", () => ({
  WebSubscriptionRevenueCat: () => null,
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useTier } from "@/lib/api/useTier";

describe("Settings Subscription page", () => {
  it("renders Subscription Plan heading", () => {
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 5, storageLimitMb: 50, role: "user" },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    expect(screen.getByRole("heading", { name: /subscription plan/i })).toBeInTheDocument();
  });

  it("shows loading when tier is loading", () => {
    vi.mocked(useTier).mockReturnValue({ data: null, isLoading: true });
    render(<SettingsSubscriptionPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows the current tier when data is loaded", () => {
    // Spec (DATA_AND_SYNC.md §9): free = 0 cloud / unlimited local. The page must not assume a 50MB
    // free cloud cap.
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 10, storageLimitMb: 0, role: "user" },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    expect(screen.getByTestId("subscription-tier")).toHaveTextContent("Free");
  });

  it("should_present_cloud_sync_as_the_paid_upgrade", () => {
    // REQ-015 / REQ-091: cloud sync (work on any device, never lose data) is the paid value prop.
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 0, storageLimitMb: 0, role: "user" },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    expect(screen.getAllByText(/sync/i).length).toBeGreaterThan(0);
  });

  it("renders back to settings link", () => {
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 0, storageLimitMb: 0, role: "user" },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    const backLink = screen.getByRole("link", { name: /back to settings/i });
    expect(backLink).toHaveAttribute("href", "/settings");
  });
});
