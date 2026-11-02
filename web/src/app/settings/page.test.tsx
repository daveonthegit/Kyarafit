import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Settings from "./page";
import { authClient } from "@/lib/auth/auth-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Spec (PRODUCT_SPEC.md §3): export/import are FREE; cloud sync is the only paid lever. The prior
// test mocked `canExport: false` and asserted an "upgrade for backup and export" prompt — that baked
// in overturned gating. Free users have export available; the upsell is sync-only.
vi.mock("@/lib/api/useTier", () => ({
  useTier: () => ({
    // Free = unlimited local / 0 cloud (DATA_AND_SYNC.md §9).
    data: { tier: "FREE", currentUsageMb: 10, storageLimitMb: 0 },
    isLoading: false,
  }),
  useFeatureAccess: () => ({
    tier: "free",
    isPaid: false,
    canUseCloudSync: false,
    canExport: true,
    canImport: true,
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("@/lib/i18n/context", () => ({
  useLocaleContext: () => ({ locale: "en", setLocale: vi.fn() }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    preference: "system",
    setPreference: vi.fn(),
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    mounted: true,
  }),
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
        if (key === "system") return "Match system";
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

  it("should_not_gate_export_behind_an_upgrade_prompt_for_free_user", () => {
    // REQ-012: export is free. The free-user upsell must NOT advertise export as a paid feature.
    render(<Settings />);
    expect(screen.queryByText(/upgrade for backup and export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export.*(requires|upgrade|pro|paid)/i)).not.toBeInTheDocument();
  });

  it("should_warn_free_user_to_export_before_sign_out", () => {
    // REQ-031: signing out on a (potentially shared) device warns free users to export first and
    // requires confirmation before the session is cleared.
    const signOut = vi.mocked(authClient.signOut);
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(screen.getByText(/export/i)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });
});
