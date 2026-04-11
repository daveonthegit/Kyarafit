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
  useFeatureAccess: () => ({ canUseCloudSync: false, canExport: false }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("@/lib/i18n/context", () => ({
  useLocaleContext: () => ({ locale: "en", setLocale: vi.fn() }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn(), toggleTheme: vi.fn(), mounted: true }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    return (key: string, values?: Record<string, string>) => {
      if (ns === "Settings") {
        if (key === "storageOf" && values) {
          return `${values.used} / ${values.limit}`;
        }
        if (key === "storageUsedUnlimited" && values) {
          return `${values.used} (unlimited)`;
        }
        const map: Record<string, string> = {
          title: "Settings",
          systemPreferences: "System preferences",
          backupStorage: "Backup & storage",
          storage: "Storage",
          upgradeForBackup: "Upgrade for backup and export",
          viewPlan: "View plan",
          profileIdentity: "Profile & identity",
          language: "Language",
          accountDetails: "Account details",
          subscriptionPlan: "Subscription plan",
          notificationStyle: "Notification style",
          signOut: "Sign out",
          backToHome: "Back to home",
        };
        return map[key] ?? key;
      }
      if (ns === "Language") {
        if (key === "en") return "English";
        if (key === "es") return "Español";
      }
      if (ns === "Theme") {
        if (key === "appearance") return "Appearance";
        if (key === "light") return "Light";
        if (key === "dark") return "Dark";
      }
      return key;
    };
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

  it("renders language selector with English and Español options", () => {
    render(<Settings />);
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Español" })).toBeInTheDocument();
  });

  it("shows upgrade prompt with link to subscription when cloud sync is not available", () => {
    render(<Settings />);
    expect(screen.getByText(/upgrade for backup and export/i)).toBeInTheDocument();
    const planLink = screen.getByRole("link", { name: /view plan/i });
    expect(planLink).toHaveAttribute("href", "/settings/subscription");
  });
});
