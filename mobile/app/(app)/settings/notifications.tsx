import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import {
  SettingsGlassFrame,
  SettingsGlassSection,
  settingsGlassStyles as styles,
} from "@/screens/settings/glassSettings";

export default function SettingsNotificationsScreen() {
  const { t } = useTranslation();
  return (
    <SettingsGlassFrame
      eyebrow={t("common.settings")}
      title={t("settings.notificationStyle")}
      description={t("settings.notificationsSubtitle")}
    >
      <SettingsGlassSection label={t("settings.notificationStyle")}>
        <Text style={styles.value}>{t("settings.notificationsSoonTitle")}</Text>
        <Text style={styles.body}>{t("settings.notificationsSoonBody")}</Text>
      </SettingsGlassSection>
      <SettingsGlassSection>
        <Text style={styles.body}>{t("settings.notificationsRoadmap")}</Text>
      </SettingsGlassSection>
    </SettingsGlassFrame>
  );
}
