import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { APP_HREF } from "@/lib/appRoutes";
import { useTier } from "@/lib/useTier";
import { useOfflineQuery } from "@/offline";
import { useReplicaSummary } from "@/vault/replica/hooks";
import { syncNow } from "@/vault/replica/ReplicaProvider";
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
 * Cloud-sync status + manual "Sync now" (DATA_AND_SYNC.md §6, REQ-D64) — settings placement per
 * owner (no omnipresent status chips, ADR-0002). Shown to Kyarafit Cloud accounts, and to a vault
 * that still has unsynced changes or changes that didn't apply after its plan lapsed. A free account
 * never triggers a Convex data call from here (REQ-D10).
 */
export function SyncStatusSection({ offline }: { offline: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const { data: tierInfo } = useTier(userId);
  const entitled = shouldRunSyncWorker(tierInfo?.tier ?? null, userId !== null);
  const { enabled, status, pending, lastSyncedAt, changes } = useReplicaSummary();
  const [syncing, setSyncing] = useState(false);

  const onSyncNow = useCallback(() => {
    if (syncing || !entitled) return;
    setSyncing(true);
    void syncNow().finally(() => setSyncing(false));
  }, [entitled, syncing]);

  if (!entitled && !(enabled && (pending > 0 || changes > 0))) return null;

  const lastSynced = formatLastSynced(lastSyncedAt);
  const statusText =
    status === "syncing"
      ? t("common.syncing")
      : status === "needs-auth"
        ? t("sync.status.needsAuth")
        : status === "not-entitled" || !entitled
          ? t("sync.status.notEntitled")
          : status === "offline" || offline
            ? t("sync.status.offline")
            : status === "error"
              ? t("sync.status.retrying")
              : pending > 0
                ? t("common.syncPendingCount", { count: pending })
                : lastSynced
                  ? t("common.lastSynced", { time: lastSynced })
                  : t("common.neverSynced");
  const attention = status === "needs-auth" || status === "error" || status === "not-entitled";

  return (
    <SurfaceCard className="mt-4 px-4 py-4">
      <MetaLabel>{t("settings.cloudSync")}</MetaLabel>
      <View className="mt-3 flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole={attention ? "alert" : undefined}
            className="text-sm text-kyar-text dark:text-kyar-dark-text"
          >
            {statusText}
          </Text>
          {pending > 0 && status !== "idle" ? (
            <Text className="mt-1 text-xs text-kyar-meta dark:text-kyar-dark-meta">
              {t("common.syncPendingCount", { count: pending })}
            </Text>
          ) : null}
        </View>
        {entitled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.syncNow")}
            disabled={syncing || offline}
            onPress={onSyncNow}
            className="min-h-[44px] items-center justify-center rounded-full border border-kyar-border px-4 active:opacity-80 disabled:opacity-50 dark:border-kyar-dark-border"
          >
            {syncing ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
                {t("common.syncNow")}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {changes > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t("sync.changes.openHint")}
          onPress={() => router.push(APP_HREF.syncChanges())}
          className="mt-3 min-h-[44px] flex-row items-center justify-between rounded-xl border border-kyar-border px-3 active:opacity-80 dark:border-kyar-dark-border"
        >
          <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
            {t("sync.changes.reviewCount", { count: changes })}
          </Text>
          <Text
            importantForAccessibility="no"
            className="text-sm text-kyar-meta dark:text-kyar-dark-meta"
          >
            ›
          </Text>
        </Pressable>
      ) : null}
    </SurfaceCard>
  );
}
