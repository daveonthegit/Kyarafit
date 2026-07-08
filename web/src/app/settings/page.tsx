"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTier } from "@/lib/api/useTier";
import { useFeatureAccess } from "@/lib/api/useTier";
import { formatStorageMb } from "@kyarafit/design-system/domain/cloudStoragePolicy";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { SignOutConfirmDialog } from "@/components/settings/SignOutConfirmDialog";
import { authClient } from "@/lib/auth/auth-client";
import { useLocaleContext } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locale";
import { useTheme } from "@/contexts/ThemeContext";

const menuItems: { labelKey: string; href: string }[] = [
  { labelKey: "accountDetails", href: "/settings/account" },
  { labelKey: "subscriptionPlan", href: "/settings/subscription" },
  { labelKey: "notificationStyle", href: "/settings/notifications" },
  { labelKey: "dataManagement", href: "/settings/data" },
];

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active
          ? "bg-glass-solid text-glass-ink"
          : "border border-glass-border-strong text-kyar-media-fg opacity-60 hover:opacity-90"
      }`}
    >
      {label}
    </button>
  );
}

export default function Settings() {
  const router = useRouter();
  const t = useTranslations("Settings");
  const tLang = useTranslations("Language");
  const tTheme = useTranslations("Theme");
  const { preference, setPreference } = useTheme();
  const { data: tier, isLoading } = useTier();
  const { canUseCloudSync } = useFeatureAccess();
  const { locale, setLocale } = useLocaleContext();
  const showUpgradePrompt = !canUseCloudSync;
  const [showSignOutWarning, setShowSignOutWarning] = useState(false);

  const performSignOut = async () => {
    setShowSignOutWarning(false);
    await authClient.signOut();
    router.push("/home");
  };

  // REQ-031: free users keep their data locally, so warn them to export a backup before the session
  // is cleared. Paid users have cloud sync and can sign out directly.
  const handleSignOut = () => {
    if (!canUseCloudSync) {
      setShowSignOutWarning(true);
      return;
    }
    void performSignOut();
  };

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href="/home"
            aria-label={t("backToHome")}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              arrow_back
            </span>
          </Link>
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[600px] px-4 sm:px-6 flex-1">
          {/* ONE glass work panel (11a) */}
          <div className="bg-glass backdrop-blur-glass border border-glass-border rounded-glass">
            <div className="px-6 py-5 sm:px-8 border-b border-glass-divider-strong">
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-2">
                {t("systemPreferences")}
              </span>
              <h1 className="font-serif italic text-[30px] font-normal tracking-[-0.01em]">
                {t("title")}
              </h1>
            </div>

            {!isLoading && tier && (
              <section className="px-6 py-5 sm:px-8 border-b border-glass-divider-strong">
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
                  {t("backupStorage")}
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55 mb-1">
                  {t("storage")}
                </span>
                {tier.storageLimitMb >= 0 ? (
                  <p className="text-sm tabular-nums">
                    {t("storageOf", {
                      used: formatStorageMb(tier.currentUsageMb),
                      limit: formatStorageMb(tier.storageLimitMb),
                    })}
                  </p>
                ) : (
                  <p className="text-sm tabular-nums">
                    {t("storageUsedUnlimited", {
                      used: formatStorageMb(tier.currentUsageMb),
                    })}
                  </p>
                )}
                {showUpgradePrompt && (
                  <UpgradePrompt
                    surface="glass"
                    message={t("upgradeForSync")}
                    linkText={t("viewPlan")}
                    className="mt-4"
                  />
                )}
              </section>
            )}

            <section className="px-6 py-5 sm:px-8 border-b border-glass-divider-strong">
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
                {t("profileIdentity")}
              </span>
              <div className="mb-5">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55 mb-3">
                  {tTheme("appearance")}
                </span>
                <div className="flex gap-2 flex-wrap">
                  {(["system", "light", "dark"] as const).map((mode) => (
                    <SegmentButton
                      key={mode}
                      active={preference === mode}
                      label={tTheme(mode)}
                      onClick={() => setPreference(mode)}
                    />
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] opacity-55 mb-3">
                  {t("language")}
                </span>
                <div className="flex gap-2 flex-wrap">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <SegmentButton
                      key={loc}
                      active={locale === loc}
                      label={tLang(loc)}
                      onClick={() => setLocale(loc as SupportedLocale)}
                    />
                  ))}
                </div>
              </div>
              <ul
                className="border-t border-glass-divider divide-y divide-glass-divider"
                role="list"
              >
                {menuItems.map(({ labelKey, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex min-h-[44px] items-center justify-between py-3 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                        {t(labelKey)}
                      </span>
                      <span className="material-symbols-outlined text-base opacity-50" aria-hidden>
                        chevron_right
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="px-6 py-5 sm:px-8 border-b border-glass-divider-strong">
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-2">
                {t("legalAndPolicies")}
              </span>
              <p className="text-xs text-media-fg-55 mb-4">{t("legalAndPoliciesSubtitle")}</p>
              <ul className="space-y-1" role="list">
                <li>
                  <Link
                    href="/terms"
                    className="inline-flex min-h-[44px] items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
                  >
                    <span className="border-b border-glass-border-strong pb-0.5">
                      {t("termsOfService")}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="inline-flex min-h-[44px] items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
                  >
                    <span className="border-b border-glass-border-strong pb-0.5">
                      {t("privacyPolicy")}
                    </span>
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
                    className="inline-flex min-h-[44px] items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
                  >
                    <span className="border-b border-glass-border-strong pb-0.5">
                      {t("securitySupport")}
                    </span>
                  </a>
                </li>
              </ul>
            </section>

            <div className="px-6 py-5 sm:px-8">
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] inline-flex items-center rounded-full border border-on-glass-danger/60 px-6 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger transition-colors hover:bg-on-glass-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        </main>

        {showSignOutWarning && (
          <SignOutConfirmDialog
            title={t("signOutConfirmTitle")}
            description={t("signOutExportWarning")}
            confirmLabel={t("signOutConfirm")}
            cancelLabel={t("signOutCancel")}
            onConfirm={() => void performSignOut()}
            onCancel={() => setShowSignOutWarning(false)}
          />
        )}
      </div>
    </WebAppShell>
  );
}
