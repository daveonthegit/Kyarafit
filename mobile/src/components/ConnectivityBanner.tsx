import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { useSyncStatus } from "@/offline";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

/**
 * Offline connectivity strip (DATA_AND_SYNC.md §6, REQ-D64) — floats below
 * the status bar as a dark glass strip (7.1 shell). The online sync-status
 * half of the old banner lives in `SyncStatusChip` (bottom-left, per
 * 03-component-changes).
 */
export function ConnectivityBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  const { pending, failed } = useSyncStatus();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.default,
        backgroundColor: glass.fallback.overlay,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 13,
          color: glass.text.fg,
        }}
      >
        {t("common.offlineBanner")}
      </Text>
      {pending > 0 ? (
        <Text
          style={{
            marginTop: 4,
            textAlign: "center",
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 12,
            color: glass.text.fg70,
          }}
        >
          {t("common.syncPendingCount", {
            defaultValue: "{{count}} pending changes waiting to sync",
            count: pending,
          })}
        </Text>
      ) : null}
      {failed > 0 ? (
        <Text
          accessibilityRole="alert"
          style={{
            marginTop: 4,
            textAlign: "center",
            fontFamily: APP_FONT_FAMILIES.sansMedium,
            fontSize: 12,
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
  );
}
