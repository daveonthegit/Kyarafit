"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WebAppShell } from "@/components/layout/WebAppShell";

export default function SettingsNotificationsPage() {
  const t = useTranslations("Settings");

  return (
    <WebAppShell>
      <PageHeader
        title={t("notificationStyle")}
        subtitle={t("title")}
        trailing={
          <Link
            href="/settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            aria-label={t("backToSettings")}
          >
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              arrow_back
            </span>
          </Link>
        }
      />

      <main className="flex-1 space-y-6 pb-24 lg:pb-8">
        <p className="text-sm text-kyar-textSecondary">{t("notificationsSubtitle")}</p>
        <SectionCard title={t("notificationStyle")}>
          <p
            className="text-lg font-semibold text-kyar-text"
            data-testid="notifications-placeholder"
          >
            {t("notificationsSoonTitle")}
          </p>
          <p className="mt-3 text-sm leading-6 text-kyar-textSecondary">
            {t("notificationsSoonBody")}
          </p>
          <div className="mt-4 rounded-2xl bg-kyar-panel px-4 py-4">
            <p className="text-sm leading-6 text-kyar-textSecondary">{t("notificationsRoadmap")}</p>
          </div>
        </SectionCard>
      </main>
    </WebAppShell>
  );
}
