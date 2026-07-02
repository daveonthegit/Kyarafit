import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useConvex, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { useTier } from "@/lib/useTier";
import { syncNow, useSyncStatus } from "@/offline";

function formatLastSynced(ts: number | null): string | null {
  if (ts === null) return null;
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * Global sync-status surface (DATA_AND_SYNC.md §6, REQ-D64). Extends the offline connectivity
 * banner with the pending badge, the last-synced timestamp, a manual "Sync now" trigger, and a
 * surfaced failed-sync error state.
 *
 * The sync controls (last-synced + Sync now) only appear for a paid, signed-in user — the same
 * `shouldRunSyncWorker` gate the worker itself uses — so a free/signed-out user never triggers a
 * Convex data call (REQ-D10). Everyone still sees the offline banner and any queued-change counts.
 */
export function ConnectivityBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const convex = useConvex();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier(userId);
  const syncEnabled = shouldRunSyncWorker(tierInfo?.tier ?? null, signedIn);

  const { pending, failed, lastSyncedAt } = useSyncStatus();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);

  const onSyncNow = useCallback(() => {
    if (syncing || !syncEnabled) return;
    setSyncing(true);
    void syncNow(convex).finally(() => setSyncing(false));
  }, [convex, syncEnabled, syncing]);

  const failedNotice =
    failed > 0 ? (
      <Text
        accessibilityRole="alert"
        className="mt-1 text-center text-xs font-medium text-kyar-danger dark:text-kyar-dark-danger"
      >
        {t("common.syncFailedCount", {
          defaultValue: "{{count}} change(s) failed to sync",
          count: failed,
        })}
      </Text>
    ) : null;

  if (offline) {
    return (
      <View className="border-b border-kyar-border bg-kyar-accentSoft px-4 py-2 dark:border-kyar-dark-border dark:bg-kyar-dark-accentSoft">
        <Text className="text-center text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
          {t("common.offlineBanner")}
        </Text>
        {pending > 0 ? (
          <Text className="mt-1 text-center text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("common.syncPendingCount", {
              defaultValue: "{{count}} pending changes waiting to sync",
              count: pending,
            })}
          </Text>
        ) : null}
        {failedNotice}
      </View>
    );
  }

  // Online: show the sync-status row only for paid, signed-in users with something to report.
  if (!syncEnabled || (pending === 0 && failed === 0 && lastSyncedAt === null)) {
    return null;
  }

  const lastSynced = formatLastSynced(lastSyncedAt);

  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-kyar-border bg-kyar-bg px-4 py-2 dark:border-kyar-dark-border dark:bg-kyar-dark-bg">
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {pending > 0
            ? t("common.syncPendingCount", {
                defaultValue: "{{count}} pending changes waiting to sync",
                count: pending,
              })
            : lastSynced
              ? t("common.lastSynced", { defaultValue: "Last synced {{time}}", time: lastSynced })
              : t("common.neverSynced", { defaultValue: "Not synced yet" })}
        </Text>
        {failedNotice}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.syncNow", { defaultValue: "Sync now" })}
        disabled={syncing}
        onPress={onSyncNow}
        className="rounded-full border border-kyar-border px-3 py-1.5 active:opacity-80 disabled:opacity-50 dark:border-kyar-dark-border"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
          {syncing
            ? t("common.syncing", { defaultValue: "Syncing…" })
            : t("common.syncNow", { defaultValue: "Sync now" })}
        </Text>
      </Pressable>
    </View>
  );
}
