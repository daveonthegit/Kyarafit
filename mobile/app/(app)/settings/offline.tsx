import { useEffect, useState } from "react";
import { Text } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";

import { usePendingQueueCount } from "@/offline";
import { SyncStatusSection } from "@/components/settings/SyncStatusSection";
import {
  SettingsGlassFrame,
  SettingsGlassSection,
  settingsGlassStyles as styles,
} from "@/screens/settings/glassSettings";

export default function SettingsOfflineScreen() {
  const { t } = useTranslation();
  const pending = usePendingQueueCount();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);

  return (
    <SettingsGlassFrame
      eyebrow={t("common.settings")}
      title={t("settings.offlineCapability")}
      description={t("settings.offlineCapabilityIntro")}
    >
      <SettingsGlassSection label={t("settings.connectionStatus")}>
        <Text accessibilityLiveRegion="polite" style={styles.value}>
          {offline ? t("settings.connectionOffline") : t("settings.connectionOnline")}
        </Text>
      </SettingsGlassSection>

      {/* Placement and implementation are reserved by the existing sync contract (ADR-0002). */}
      <SyncStatusSection offline={offline} />

      <SettingsGlassSection label={t("settings.pendingMutations")}>
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {pending}
        </Text>
        <Text style={styles.body}>{t("settings.pendingMutationsHint")}</Text>
      </SettingsGlassSection>
      <SettingsGlassSection>
        <Text style={styles.body}>{t("settings.offlineCapabilityFootnote")}</Text>
      </SettingsGlassSection>
    </SettingsGlassFrame>
  );
}
