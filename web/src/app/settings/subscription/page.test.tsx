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
      data: { tier: "FREE", currentUsageMb: 5, storageLimitMb: 50 },
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

  it("shows tier and storage when data is loaded", () => {
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 10, storageLimitMb: 50 },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    expect(screen.getByTestId("subscription-tier")).toHaveTextContent("Free");
    expect(screen.getByTestId("subscription-storage")).toBeInTheDocument();
  });

  it("renders back to settings link", () => {
    vi.mocked(useTier).mockReturnValue({
      data: { tier: "FREE", currentUsageMb: 0, storageLimitMb: 50 },
      isLoading: false,
    });
    render(<SettingsSubscriptionPage />);
    const backLink = screen.getByRole("link", { name: /back to settings/i });
    expect(backLink).toHaveAttribute("href", "/settings");
  });
});
