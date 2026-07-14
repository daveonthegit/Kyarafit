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
 * Sync-status settings section (DATA_AND_SYNC.md §6, REQ-D64): last-synced timestamp, pending
 * badge, a manual "Sync now" trigger, and a surfaced failed-sync error state. Lives on the
 * Backup & data settings page (per owner: no omnipresent floating status chips) — mobile mirrors
 * it on the offline settings screen.
 *
 * Only renders for a paid, signed-in user — the same `shouldRunSyncWorker` gate the worker uses —
 * so a free/signed-out user never triggers a Convex data call (REQ-D10).
 */
export function SyncStatus() {
  const t = useTranslations("Sync");
  const convex = useConvex();
  const { userId } = useCurrentUser();
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier();
  const syncEnabled = shouldRunSyncWorker(tierInfo?.tier ?? null, signedIn);
  const { isOnline } = useIsOnline();
  const { pending, failed, lastSyncedAt, backfill } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);

  const onSyncNow = useCallback(() => {
    if (syncing || !syncEnabled) return;
    setSyncing(true);
    void syncNow(convex, { tier: tierInfo?.tier ?? null }).finally(() => setSyncing(false));
  }, [convex, syncEnabled, syncing, tierInfo?.tier]);

  if (!syncEnabled) return null;

  const backingUp = backfill.running;
  const lastSynced = formatLastSynced(lastSyncedAt);
  // REQ-D95: a one-time "Backing up your library… N/M" indicator takes priority while it runs.
  const statusText = backingUp
    ? t("backingUp", { done: backfill.done, total: backfill.total })
    : !isOnline
      ? t("offline")
      : pending > 0
        ? t("pending", { count: pending })
        : lastSynced
          ? t("lastSynced", { time: lastSynced })
          : t("neverSynced");

  return (
    <section role="status" aria-live="polite">
      <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
        {t("sectionTitle")}
      </span>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-kyar-media-fg">{statusText}</p>
          {failed > 0 ? (
            <p className="mt-1 text-sm font-medium text-on-glass-danger">
              {t("failed", { count: failed })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing || !isOnline}
          className="shrink-0 min-h-[44px] inline-flex items-center rounded-full border border-glass-border-strong bg-glass-bar px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? t("syncing") : t("syncNow")}
        </button>
      </div>
    </section>
  );
}
