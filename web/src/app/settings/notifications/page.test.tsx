import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsNotificationsPage from "./page";

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => {
    return (key: string) => {
      const map: Record<string, string> = {
        title: "Settings",
        notificationStyle: "Notification Style",
        notificationsSubtitle:
          "Choose which notifications you want once notification settings are ready.",
        notificationsSoonTitle: "Notification settings are on deck",
        notificationsSoonBody:
          "Notification controls are coming soon. For now, important account messages will still appear in the app.",
        notificationsRoadmap:
          "Planned controls: account alerts, optional updates, and reminders for builds and tasks.",
        backToSettings: "Back to settings",
      };
      return map[key] ?? key;
    };
  },
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({
    title,
    subtitle,
    trailing,
  }: {
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {trailing}
    </header>
  ),
}));

describe("Settings Notifications page", () => {
  it("renders Notification Style heading", () => {
    render(<SettingsNotificationsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /notification style/i })
    ).toBeInTheDocument();
  });

  it("renders placeholder content", () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByTestId("notifications-placeholder")).toHaveTextContent(
      /notification settings are on deck/i
    );
  });

  it("renders back to settings link", () => {
    render(<SettingsNotificationsPage />);
    const backLink = screen.getByRole("link", { name: /back to settings/i });
    expect(backLink).toHaveAttribute("href", "/settings");
  });
});
