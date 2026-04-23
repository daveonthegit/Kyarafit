import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Link, type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { NAV_SECTIONS_PRIMARY, type NavSection, type NavSectionId } from "@kyarafit/design-system";
import { signOut } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { NAV_SECTION_MATERIAL_ICON } from "@/lib/navIconsMobile";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

const IN_TAB_BAR = new Set<NavSectionId>(["home", "builds", "elements", "planner"]);
const NATIVE_SECTION_HREF: Partial<Record<NavSectionId, Href>> = {
  events: APP_HREF.conventions,
  groups: APP_HREF.groups,
  discover: APP_HREF.discover,
  feed: APP_HREF.feed,
};

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useDesignTheme();
  const [signingOut, setSigningOut] = useState(false);

  const overflowSections = NAV_SECTIONS_PRIMARY.filter((section) => !IN_TAB_BAR.has(section.id));

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{ paddingBottom: spacing[10] }}
    >
      <View className="px-5 pb-2 pt-4">
        <SectionHeading eyebrow={t("more.sectionExplore")} title={t("common.more")} />
        <Text className="mt-3 max-w-[320px] text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("more.subtitle")}
        </Text>
      </View>

      <View className="mt-4 gap-4 px-5">
        <SurfaceCard className="overflow-hidden">
          <View className="px-4 pb-2 pt-4">
            <MetaLabel>{t("more.destinationsTitle")}</MetaLabel>
          </View>
          {overflowSections.map((section, index) => (
            <NavRow
              key={section.id}
              section={section}
              subtitle={
                NATIVE_SECTION_HREF[section.id]
                  ? t("more.nativeRouteSubtitle")
                  : t("more.opensInBrowser")
              }
              href={NATIVE_SECTION_HREF[section.id]}
              onPressWeb={() => undefined}
              t={t}
              iconColor={colors.text}
              metaColor={colors.meta}
              showBorder={index < overflowSections.length - 1}
            />
          ))}
        </SurfaceCard>

        <SurfaceCard className="overflow-hidden">
          <View className="px-4 pb-2 pt-4">
            <MetaLabel>{t("common.settings")}</MetaLabel>
          </View>
          <Link href={APP_HREF.settings} asChild>
            <Pressable className="flex-row items-center gap-3 px-4 py-3 active:bg-kyar-muted/60 dark:active:bg-kyar-dark-muted/60">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-kyar-muted dark:bg-kyar-dark-muted">
                <MaterialIcons name="settings" size={22} color={colors.text} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                  {t("common.settings")}
                </Text>
                <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("more.settingsSubtitle")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.meta} />
            </Pressable>
          </Link>
        </SurfaceCard>

        <Pressable
          style={{
            minHeight: 52,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
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
      </View>
    </ScrollView>
  );
}

function NavRow({
  section,
  subtitle,
  onPressWeb,
  loading,
  href,
  t,
  showBorder,
  iconColor,
  metaColor,
}: {
  section: NavSection;
  subtitle: string;
  onPressWeb: () => void;
  loading?: boolean;
  href?: Href;
  t: (k: string) => string;
  showBorder?: boolean;
  iconColor: string;
  metaColor: string;
}) {
  const iconName = (NAV_SECTION_MATERIAL_ICON[section.id] ??
    "circle") as keyof typeof MaterialIcons.glyphMap;

  const row = (
    <Pressable
      onPress={href ? undefined : onPressWeb}
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-kyar-muted/60 dark:active:bg-kyar-dark-muted/60 ${
        showBorder ? "border-b border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle" : ""
      }`}
      accessibilityRole="button"
      accessibilityLabel={t(`nav.${section.id}`)}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-kyar-muted dark:bg-kyar-dark-muted">
        <MaterialIcons name={iconName} size={22} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
          {t(`nav.${section.id}`)}
        </Text>
        <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <Ionicons name={href ? "chevron-forward" : "open-outline"} size={18} color={metaColor} />
      )}
    </Pressable>
  );

  if (!href) {
    return row;
  }

  return (
    <Link href={href} asChild>
      {row}
    </Link>
  );
}
