import { useCallback, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { NAV_SECTIONS_PRIMARY, type NavSection, type NavSectionId } from "@kyarafit/design-system";
import { colors, spacing } from "@kyarafit/design-system/rn";
import { signOut } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { EXPO_PUBLIC_WEB_APP_URL } from "@/config/env";
import { NAV_SECTION_IONICON } from "@/lib/navIconsMobile";

/** Same primary destinations as bottom tabs — hidden in this screen (they have their own tab). */
const IN_TAB_BAR = new Set<NavSectionId>(["home", "builds", "elements", "planner"]);

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const overflowSections = NAV_SECTIONS_PRIMARY.filter((s) => !IN_TAB_BAR.has(s.id));

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  const openWebPath = useCallback(
    async (path: string) => {
      const base = EXPO_PUBLIC_WEB_APP_URL.trim().replace(/\/$/, "");
      if (!base) {
        Alert.alert(t("more.webUnavailableTitle"), t("more.webUnavailableBody"));
        return;
      }
      try {
        await WebBrowser.openBrowserAsync(`${base}${path}`);
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [t]
  );

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: spacing[10] }}
    >
      <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
          }}
        >
          {t("common.more")}
        </Text>
        <Text style={{ marginTop: spacing[2], color: colors.textSecondary, fontSize: 14 }}>
          {t("more.subtitle")}
        </Text>
      </View>

      <Text
        style={{
          marginTop: spacing[6],
          marginHorizontal: spacing[5],
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 2.4,
          color: colors.meta,
          textTransform: "uppercase",
        }}
      >
        {t("more.sectionExplore")}
      </Text>

      <View style={{ marginTop: spacing[3] }}>
        {overflowSections.map((section) => (
          <NavRow key={section.id} section={section} onPressWeb={() => openWebPath(section.path)} t={t} />
        ))}
      </View>

      <View style={{ marginTop: spacing[6], marginHorizontal: spacing[5], height: 1, backgroundColor: colors.border }} />

      <View style={{ marginTop: spacing[4] }}>
        <SettingsRow t={t} />
      </View>

      <Pressable
        style={{
          marginHorizontal: spacing[5],
          marginTop: spacing[6],
          paddingVertical: spacing[4],
          alignItems: "center",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={() => void onSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel={t("common.signOut")}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={{ fontWeight: "600", color: colors.text }}>{t("common.signOut")}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function NavRow({
  section,
  onPressWeb,
  t,
}: {
  section: NavSection;
  onPressWeb: () => void;
  t: (k: string) => string;
}) {
  const iconName = (NAV_SECTION_IONICON[section.id] ?? "ellipse-outline") as keyof typeof Ionicons.glyphMap;
  return (
    <Pressable
      onPress={onPressWeb}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 48,
        paddingHorizontal: spacing[5],
        gap: spacing[4],
        backgroundColor: pressed ? colors.muted : colors.bg,
      })}
      accessibilityRole="button"
      accessibilityLabel={t(`nav.${section.id}`)}
    >
      <Ionicons name={iconName} size={22} color={colors.text} style={{ opacity: 0.85 }} />
      <Text
        style={{
          flex: 1,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 2,
          color: colors.text,
          textTransform: "uppercase",
        }}
      >
        {t(`nav.${section.id}`)}
      </Text>
      <Ionicons name="open-outline" size={18} color={colors.meta} />
    </Pressable>
  );
}

function SettingsRow({ t }: { t: (k: string) => string }) {
  const iconName = (NAV_SECTION_IONICON.settings ?? "settings-outline") as keyof typeof Ionicons.glyphMap;
  return (
    <Link href={APP_HREF.settings} asChild>
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          minHeight: 48,
          paddingHorizontal: spacing[5],
          gap: spacing[4],
          backgroundColor: pressed ? colors.muted : colors.bg,
        })}
        accessibilityRole="button"
        accessibilityLabel={t("nav.settings")}
      >
        <Ionicons name={iconName} size={22} color={colors.text} style={{ opacity: 0.85 }} />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 2,
            color: colors.text,
            textTransform: "uppercase",
          }}
        >
          {t("nav.settings")}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.meta} />
      </Pressable>
    </Link>
  );
}
