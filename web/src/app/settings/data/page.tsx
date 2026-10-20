"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime } from "@/lib/offline";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { SyncStatus } from "@/components/SyncStatus";
import { readLocalCollections } from "@/lib/localFirstData";
import { buildDataBundle, countRows } from "@/lib/dataPortability";

/** Trigger a browser download of `contents` as `filename`. No-op safe outside a DOM. */
function downloadFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Settings → Backup & data on web. Web shows published copies only (ADR-0005): personal data is
 * edited, and backups are restored, in the mobile app, so this page exports what this browser holds
 * and explains where restore lives instead of offering a restore that would write personal rows.
 */
export default function SettingsDataPage() {
  const t = useTranslations("DataPortability");
  const { userId, isLoading } = useCurrentUser();

  // Export reads the LOCAL STORE via the offline runtime (DATA_AND_SYNC.md §11, invariant #2).
  const version = useSyncExternalStore(
    offlineRuntime.subscribe,
    offlineRuntime.getVersion,
    offlineRuntime.getVersion
  );
  const collections = useMemo(() => readLocalCollections(userId), [version, userId]);
  const totalRows = countRows(collections);

  const handleExport = useCallback(() => {
    const bundle = buildDataBundle(collections);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`kyarafit-export-${stamp}.json`, bundle);
  }, [collections]);

  return (
    <SettingsGlassShell eyebrow={t("subtitle")} title={t("title")} backLabel={t("backToSettings")}>
      <div className="space-y-8">
        <SyncStatus />
        <section className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-glass-divider-strong [&:not(:first-child)]:pt-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
            {t("exportTitle")}
          </span>
          <p className="text-sm leading-6 text-media-fg-70">{t("exportDescription")}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
            {isLoading ? t("loading") : t("itemCount", { count: totalRows })}
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isLoading}
            className="mt-4 min-h-[44px] inline-flex items-center rounded-full bg-glass-solid px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("exportButton")}
          </button>
        </section>

        <section className="border-t border-glass-divider-strong pt-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
            {t("importTitle")}
          </span>
          <p className="text-sm leading-6 text-media-fg-70" data-testid="import-unavailable">
            {t("importInMobileApp")}
          </p>
        </section>
      </div>
    </SettingsGlassShell>
  );
}
