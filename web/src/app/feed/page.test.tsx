import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FeedPage from "./page";

// REQ-082/101: the feed is an online-only surface. When offline it must render the non-blocking
// offline banner at the top of the surface (and still not crash).

const h = vi.hoisted(() => ({ isOnline: false }));

vi.mock("@/lib/useIsOnline", () => ({
  useIsOnline: () => ({ isOnline: h.isOnline, recheck: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      offlineTitle: "You're offline",
      offlineMessage: "Social, groups, and sharing need a connection.",
      retry: "Retry",
    };
    return map[key] ?? key;
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ userId: "user-1", isLoading: false, isAuthenticated: true }),
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ message }: { message: string }) => <p>{message}</p>,
}));

vi.mock("@/components/social/PublicBuildCard", () => ({
  PublicBuildCard: () => null,
}));

describe("Feed page (online-only surface)", () => {
  it("should_show_offline_banner_on_online_only_surface_when_offline", () => {
    h.isOnline = false;
    render(<FeedPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("hides the offline banner when online", () => {
    h.isOnline = true;
    render(<FeedPage />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
