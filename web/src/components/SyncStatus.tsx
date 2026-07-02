"use client";

import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTier } from "@/lib/api/useTier";
import { useIsOnline } from "@/lib/useIsOnline";
import { syncNow, useSyncStatus } from "@/lib/offline";

function formatLastSynced(ts: number | null): string | null {
  if (ts === null) return null;
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * Global sync-status surface (DATA_AND_SYNC.md §6, REQ-D64): last-synced timestamp, pending badge,
 * a manual "Sync now" trigger, and a surfaced failed-sync error state. The web mirror of mobile's
 * `ConnectivityBanner` sync row.
 *
 * Only renders for a paid, signed-in user — the same `shouldRunSyncWorker` gate the worker uses — so
 * a free/signed-out user never triggers a Convex data call (REQ-D10). Mounted app-wide as an
 * unobtrusive fixed pill; renders nothing when there is nothing to report.
 */
export function SyncStatus() {
  const t = useTranslations("Sync");
  const convex = useConvex();
  const { userId } = useCurrentUser();
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier();
  const syncEnabled = shouldRunSyncWorker(tierInfo?.tier ?? null, signedIn);
  const { isOnline } = useIsOnline();
  const { pending, failed, lastSyncedAt } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);

  const onSyncNow = useCallback(() => {
    if (syncing || !syncEnabled) return;
    setSyncing(true);
    void syncNow(convex).finally(() => setSyncing(false));
  }, [convex, syncEnabled, syncing]);

  if (!syncEnabled) return null;
  const hasSomethingToReport = pending > 0 || failed > 0 || lastSyncedAt !== null || !isOnline;
  if (!hasSomethingToReport) return null;

  const lastSynced = formatLastSynced(lastSyncedAt);
  const statusText = !isOnline
    ? t("offline")
    : pending > 0
      ? t("pending", { count: pending })
      : lastSynced
        ? t("lastSynced", { time: lastSynced })
        : t("neverSynced");

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-40 flex max-w-xs items-center gap-3 rounded-sm border border-kyar-borderSubtle bg-kyar-muted px-3 py-2 text-kyar-text shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{statusText}</p>
        {failed > 0 ? (
          <p className="mt-0.5 text-xs font-semibold text-kyar-danger">
            {t("failed", { count: failed })}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onSyncNow}
        disabled={syncing || !isOnline}
        className="shrink-0 rounded-sm border border-kyar-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-kyar-text transition-colors hover:bg-kyar-text hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {syncing ? t("syncing") : t("syncNow")}
      </button>
    </div>
  );
}
