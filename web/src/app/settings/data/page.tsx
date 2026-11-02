"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime } from "@/lib/offline";
import { readOnline, subscribeConnectivity } from "@/lib/auth/localAccount";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { SyncStatus } from "@/components/SyncStatus";
import { readLocalCollections } from "@/lib/localFirstData";
import { fetchCloudCollections, mergeCollections } from "@/lib/cloudExport";
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
 * Settings → Backup & data on web. Web edits save straight to the account while online (ADR-0006),
 * so Export fetches the account's rows on demand and merges in anything this browser's local store
 * still retains. Offline it exports the local store alone and says so. Backup-file restore is not
 * offered on web, because a restore would replay personal rows without a vault to reconcile them.
 */
export default function SettingsDataPage() {
  const t = useTranslations("DataPortability");
  const convex = useConvex();
  const { userId, identity, isLoading, isAuthenticated } = useCurrentUser();
  const online = useSyncExternalStore(subscribeConnectivity, readOnline, () => true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exportedCount, setExportedCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Retained local-store rows (DATA_AND_SYNC.md §11); the only source while offline.
  const version = useSyncExternalStore(
    offlineRuntime.subscribe,
    offlineRuntime.getVersion,
    offlineRuntime.getVersion
  );
  const localCollections = useMemo(() => readLocalCollections(userId), [version, userId]);

  // Online but the session is still resolving: wait rather than export the local store alone.
  const waitingForAccount = isLoading || (online && identity === undefined);
  const accountReachable = online && isAuthenticated;

  const handleExport = useCallback(async () => {
    setFailed(false);
    setExportedCount(null);
    let collections = localCollections;
    if (isAuthenticated && readOnline()) {
      setBusy(true);
      try {
        const server = await fetchCloudCollections(convex, {
          onProgress: (done, total) => setProgress({ done, total }),
        });
        collections = mergeCollections(server, localCollections);
      } catch {
        setFailed(true);
        return;
      } finally {
        setBusy(false);
        setProgress(null);
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`kyarafit-export-${stamp}.json`, buildDataBundle(collections));
    setExportedCount(countRows(collections));
  }, [convex, isAuthenticated, localCollections]);

  return (
    <SettingsGlassShell eyebrow={t("subtitle")} title={t("title")} backLabel={t("backToSettings")}>
      <div className="space-y-8">
        <SyncStatus />
        <section className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-glass-divider-strong [&:not(:first-child)]:pt-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
            {t("exportTitle")}
          </span>
          <p className="text-sm leading-6 text-media-fg-70">{t("exportDescription")}</p>
          <p
            className="mt-2 text-[10px] uppercase tracking-[0.16em] text-media-fg-55"
            data-testid="export-source"
          >
            {waitingForAccount
              ? t("loading")
              : accountReachable
                ? t("accountExportNote")
                : t("localOnlyNotice", { count: countRows(localCollections) })}
          </p>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={waitingForAccount || busy}
            aria-busy={busy}
            className="mt-4 min-h-[44px] inline-flex items-center rounded-full bg-glass-solid px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!busy
              ? t("exportButton")
              : progress && progress.total > 0
                ? t("exportPreparingProgress", progress)
                : t("exportPreparing")}
          </button>
          {failed && (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-glass-border-strong bg-glass-active px-4 py-3 text-sm leading-6 text-on-glass-danger"
            >
              {t("exportFailed")}
            </p>
          )}
          {exportedCount !== null && (
            <p aria-live="polite" className="mt-3 text-sm leading-6 text-media-fg-70">
              {t("exportedCount", { count: exportedCount })}
            </p>
          )}
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
