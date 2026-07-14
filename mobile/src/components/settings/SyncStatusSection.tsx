import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useConvex, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { useTier } from "@/lib/useTier";
import { syncNow, useSyncStatus } from "@/offline";
import { MetaLabel, SurfaceCard } from "@/ui";

function formatLastSynced(ts: number | null): string | null {
  if (ts === null) return null;
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * Cloud-sync status + manual "Sync now" (DATA_AND_SYNC.md §6, REQ-D64) —
 * settings placement per owner (no omnipresent status chips; web mirrors
 * this on Settings → Backup & data). Same `shouldRunSyncWorker` gate the
 * worker uses, so a free/signed-out user never triggers a Convex data call
 * (REQ-D10).
 */
export function SyncStatusSection({ offline }: { offline: boolean }) {
  const { t } = useTranslation();
  const convex = useConvex();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier(userId);
  const syncEnabled = shouldRunSyncWorker(tierInfo?.tier ?? null, signedIn);
  const { pending, failed, lastSyncedAt, backfill } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);

  const onSyncNow = useCallback(() => {
    if (syncing || !syncEnabled) return;
    setSyncing(true);
    void syncNow(convex, { tier: tierInfo?.tier ?? null }).finally(() => setSyncing(false));
  }, [convex, syncEnabled, syncing, tierInfo?.tier]);

  if (!syncEnabled) return null;

  const lastSynced = formatLastSynced(lastSyncedAt);
  // REQ-D95: a one-time "Backing up your library… N/M" indicator takes priority while it runs.
  const statusText = backfill.running
    ? t("common.backingUp", {
        defaultValue: "Backing up your library… {{done}}/{{total}}",
        done: backfill.done,
        total: backfill.total,
      })
    : pending > 0
      ? t("common.syncPendingCount", {
          defaultValue: "{{count}} pending changes waiting to sync",
          count: pending,
        })
      : lastSynced
        ? t("common.lastSynced", { defaultValue: "Last synced {{time}}", time: lastSynced })
        : t("common.neverSynced", { defaultValue: "Not synced yet" });

  return (
    <SurfaceCard className="mt-4 px-4 py-4">
      <MetaLabel>{t("settings.cloudSync")}</MetaLabel>
      <View className="mt-3 flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">{statusText}</Text>
          {failed > 0 ? (
            <Text
              accessibilityRole="alert"
              className="mt-1 text-sm font-medium text-kyar-danger dark:text-kyar-dark-danger"
            >
              {t("common.syncFailedCount", {
                defaultValue: "{{count}} change(s) failed to sync",
                count: failed,
              })}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.syncNow", { defaultValue: "Sync now" })}
          disabled={syncing || offline}
          onPress={onSyncNow}
          className="min-h-[44px] items-center justify-center rounded-full border border-kyar-border px-4 active:opacity-80 disabled:opacity-50 dark:border-kyar-dark-border"
        >
          {syncing ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
              {t("common.syncNow", { defaultValue: "Sync now" })}
            </Text>
          )}
        </Pressable>
      </View>
    </SurfaceCard>
  );
}
