"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTier } from "@/lib/api/useTier";
import { useFeatureAccess } from "@/lib/api/useTier";
import { formatStorageMb } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { authClient } from "@/lib/auth/auth-client";
import { useLocaleContext } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locale";

const menuItems: { labelKey: string; href: string }[] = [
  { labelKey: "accountDetails", href: "/settings/account" },
  { labelKey: "subscriptionPlan", href: "/settings/subscription" },
  { labelKey: "notificationStyle", href: "/settings/notifications" },
];

export default function Settings() {
  const router = useRouter();
  const t = useTranslations("Settings");
  const tLang = useTranslations("Language");
  const { data: tier, isLoading } = useTier();
  const { canUseCloudSync } = useFeatureAccess();
  const { locale, setLocale } = useLocaleContext();
  const showUpgradePrompt = !canUseCloudSync;

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/home");
  };

  return (
    <WebAppShell>
      <PageHeader
        title={t("title")}
        subtitle={t("systemPreferences")}
        trailing={
          <Link
            href="/home"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            aria-label={t("backToHome")}
          >
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              arrow_back
            </span>
          </Link>
        }
      />

      <main className="flex-1 space-y-6 pb-24 lg:pb-8">
        {!isLoading && tier && (
          <SectionCard title={t("backupStorage")}>
            {tier.storageLimitMb >= 0 && (
              <div className="py-3 border-b border-kyar-cardBorder">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  {t("storage")}
                </p>
                <p className="text-sm text-kyar-text">
                  {t("storageOf", {
                    used: formatStorageMb(tier.currentUsageMb),
                    limit: formatStorageMb(tier.storageLimitMb),
                  })}
                </p>
              </div>
            )}
            {tier.storageLimitMb === -1 && (
              <div className="py-3 border-b border-kyar-cardBorder">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  {t("storage")}
                </p>
                <p className="text-sm text-kyar-text">
                  {t("storageUsedUnlimited", {
                    used: formatStorageMb(tier.currentUsageMb),
                  })}
                </p>
              </div>
            )}
            {showUpgradePrompt && (
              <UpgradePrompt
                message={t("upgradeForBackup")}
                linkText={t("viewPlan")}
                className="mt-4"
              />
            )}
          </SectionCard>
        )}
        <SectionCard title={t("profileIdentity")}>
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">
              {t("language")}
            </p>
            <div className="flex gap-2 flex-wrap">
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc as SupportedLocale)}
                  className={`min-h-[44px] px-6 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
                    locale === loc
                      ? "bg-black text-white border-black shadow-md"
                      : "bg-kyar-surface text-kyar-text border-kyar-borderSubtle hover:border-kyar-text hover:bg-kyar-muted"
                  }`}
                  aria-pressed={locale === loc}
                >
                  {tLang(loc)}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-kyar-cardBorder" role="list">
            {menuItems.map(({ labelKey, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex justify-between items-center min-h-[44px] py-3 -mx-2 px-2 rounded-xl hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                >
                  <span className="text-[11px] uppercase tracking-widest font-medium text-kyar-text">
                    {t(labelKey)}
                  </span>
                  <span
                    className="material-symbols-outlined text-sm text-kyar-textTertiary"
                    aria-hidden
                  >
                    chevron_right
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
        <button
          type="button"
          onClick={handleSignOut}
          className="min-h-[44px] inline-flex items-center text-[10px] uppercase tracking-widest font-bold text-kyar-danger rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 hover:bg-red-50 px-6 py-2 transition-colors border border-transparent hover:border-red-100"
        >
          {t("signOut")}
        </button>
      </main>
    </WebAppShell>
  );
}
