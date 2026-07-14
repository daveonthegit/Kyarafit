import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useConvex, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "convex/_generated/api";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { useTier } from "@/lib/useTier";
import { syncNow, useSyncStatus } from "@/offline";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

function formatLastSynced(ts: number | null): string | null {
  if (ts === null) return null;
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * Sync-status chip (DATA_AND_SYNC.md §6, REQ-D64) — the online half of the
 * old ConnectivityBanner, restyled per 03-component-changes: a glass chip
 * bottom-left above the tab bar (web `SyncStatus` position). Same
 * `shouldRunSyncWorker` gate: only a paid, signed-in user sees it (REQ-D10).
 */
export function SyncStatusChip() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const convex = useConvex();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier(userId);
  const syncEnabled = shouldRunSyncWorker(tierInfo?.tier ?? null, signedIn);

  const { pending, failed, lastSyncedAt, backfill } = useSyncStatus();

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
    void syncNow(convex, { tier: tierInfo?.tier ?? null }).finally(() => setSyncing(false));
  }, [convex, syncEnabled, syncing, tierInfo?.tier]);

  // Offline is the ConnectivityBanner strip's job; the chip is online-only.
  if (
    offline ||
    !syncEnabled ||
    (pending === 0 && failed === 0 && lastSyncedAt === null && !backfill.running)
  ) {
    return null;
  }

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
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        bottom: insets.bottom + 72,
        maxWidth: 300,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: 12,
          borderWidth: borderWidth.hairline,
          borderColor: glass.border.default,
          backgroundColor: glass.fallback.bar,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansMedium,
              fontSize: 11,
              color: glass.text.fg70,
            }}
          >
            {statusText}
          </Text>
          {failed > 0 ? (
            <Text
              accessibilityRole="alert"
              style={{
                marginTop: 2,
                fontFamily: APP_FONT_FAMILIES.sansMedium,
                fontSize: 11,
                color: glass.text.danger,
              }}
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
          disabled={syncing}
          onPress={onSyncNow}
          hitSlop={8}
          style={({ pressed }) => ({
            borderRadius: 999,
            borderWidth: borderWidth.hairline,
            borderColor: glass.border.strong,
            paddingHorizontal: 10,
            paddingVertical: 6,
            opacity: syncing ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.16, 10),
              textTransform: "uppercase",
              color: glass.text.fg,
            }}
          >
            {syncing
              ? t("common.syncing", { defaultValue: "Syncing…" })
              : t("common.syncNow", { defaultValue: "Sync now" })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
