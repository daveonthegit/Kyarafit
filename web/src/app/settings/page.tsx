"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTier } from "@/lib/api/useTier";
import { useFeatureAccess } from "@/lib/api/useTier";
import { formatStorageMb } from "@/lib/utils";
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
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">{t("systemPreferences")}</p>
          <h1 className="font-serif text-4xl tracking-tight">{t("title")}</h1>
        </div>
        <Link href="/home" className="p-2 -mr-2" aria-label={t("backToHome")}>
          <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
        </Link>
      </header>

      <main className="mt-10 space-y-12">
        {!isLoading && tier && (
          <section>
            <h2 className="font-serif text-xl italic mb-6">{t("backupStorage")}</h2>
            {tier.storageLimitMb >= 0 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  {t("storage")}
                </p>
                <p className="text-sm">
                  {t("storageOf", {
                    used: formatStorageMb(tier.currentUsageMb),
                    limit: formatStorageMb(tier.storageLimitMb),
                  })}
                </p>
              </div>
            )}
            {tier.storageLimitMb === -1 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  {t("storage")}
                </p>
                <p className="text-sm">
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
          </section>
        )}
        <section>
          <h2 className="font-serif text-xl italic mb-6">{t("profileIdentity")}</h2>
          <div className="py-5 border-b border-gray-100 -mx-2 px-2">
            <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-2">
              {t("language")}
            </p>
            <div className="flex gap-2 flex-wrap">
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc as SupportedLocale)}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    locale === loc
                      ? "bg-kyar-text text-kyar-bg"
                      : "bg-gray-100 text-kyar-text hover:bg-gray-200"
                  }`}
                  aria-pressed={locale === loc}
                >
                  {tLang(loc)}
                </button>
              ))}
            </div>
          </div>
          {menuItems.map(({ labelKey, href }) => (
            <Link
              key={href}
              href={href}
              className="flex justify-between items-center py-5 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 rounded"
            >
              <span className="text-[11px] uppercase tracking-widest font-medium">
                {t(labelKey)}
              </span>
              <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            </Link>
          ))}
        </section>
        <button
          onClick={handleSignOut}
          className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80 text-left"
        >
          {t("signOut")}
        </button>
      </main>
    </WebAppShell>
  );
}
