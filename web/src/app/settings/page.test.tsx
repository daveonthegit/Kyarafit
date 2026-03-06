import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Settings from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api/useTier", () => ({
  useTier: () => ({
    data: { tier: "FREE", currentUsageMb: 10, storageLimitMb: 50 },
    isLoading: false,
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Settings heading", () => {
    render(<Settings />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders menu links to account, subscription, and notifications", () => {
    render(<Settings />);
    const accountLink = screen.getByRole("link", { name: /account details/i });
    const subscriptionLink = screen.getByRole("link", { name: /subscription plan/i });
    const notificationsLink = screen.getByRole("link", { name: /notification style/i });
    expect(accountLink).toBeInTheDocument();
    expect(accountLink).toHaveAttribute("href", "/settings/account");
    expect(subscriptionLink).toBeInTheDocument();
    expect(subscriptionLink).toHaveAttribute("href", "/settings/subscription");
    expect(notificationsLink).toBeInTheDocument();
    expect(notificationsLink).toHaveAttribute("href", "/settings/notifications");
  });

  it("renders Sign Out button", () => {
    render(<Settings />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
