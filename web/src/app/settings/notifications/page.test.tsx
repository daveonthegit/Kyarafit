import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsNotificationsPage from "./page";

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Settings Notifications page", () => {
  it("renders Notification Style heading", () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByRole("heading", { name: /notification style/i })).toBeInTheDocument();
  });

  it("renders placeholder content", () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByTestId("notifications-placeholder")).toHaveTextContent(
      /notification preferences coming soon/i
    );
  });

  it("renders back to settings link", () => {
    render(<SettingsNotificationsPage />);
    const backLink = screen.getByRole("link", { name: /back to settings/i });
    expect(backLink).toHaveAttribute("href", "/settings");
  });
});
