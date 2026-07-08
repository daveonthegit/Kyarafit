"use client";

import { useTranslations } from "next-intl";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";

export default function SettingsNotificationsPage() {
  const t = useTranslations("Settings");

  return (
    <SettingsGlassShell
      eyebrow={t("title")}
      title={t("notificationStyle")}
      backLabel={t("backToSettings")}
    >
      <p className="text-sm text-media-fg-70 mb-5">{t("notificationsSubtitle")}</p>
      <p className="text-lg font-semibold" data-testid="notifications-placeholder">
        {t("notificationsSoonTitle")}
      </p>
      <p className="mt-3 text-sm leading-6 text-media-fg-70">{t("notificationsSoonBody")}</p>
      <div className="mt-4 rounded-[10px] border border-glass-border bg-glass-active px-4 py-4">
        <p className="text-sm leading-6 text-media-fg-70">{t("notificationsRoadmap")}</p>
      </div>
    </SettingsGlassShell>
  );
}
