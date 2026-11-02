import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnlineOnlyBanner } from "./OnlineOnlyBanner";

// REQ-082/101: online-only surfaces (social, groups, billing) must surface a clear, non-blocking
// offline banner and never crash. This drives the real `useIsOnline` hook via `navigator.onLine`.

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

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

afterEach(() => {
  setOnline(true);
});

describe("OnlineOnlyBanner", () => {
  it("renders nothing while online", () => {
    setOnline(true);
    const { container } = render(<OnlineOnlyBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should_show_offline_banner_on_online_only_surface_when_offline", () => {
    setOnline(false);
    render(<OnlineOnlyBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    // Non-blocking retry affordance is present.
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
