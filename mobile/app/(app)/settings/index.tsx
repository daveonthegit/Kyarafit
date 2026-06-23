import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Link, Stack, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { setAppLocale, SUPPORTED_LOCALES, type AppLocale } from "@/i18n";
import { APP_HREF } from "@/lib/appRoutes";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { formatStorageMb } from "@/lib/formatStorageMb";
import { signOut } from "@/lib/auth/client";
import { useTier } from "@/lib/useTier";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

const SETTINGS_LINKS = [
  { key: "accountDetails", href: APP_HREF.settingsAccount, icon: "person-circle-outline" },
  { key: "subscriptionPlan", href: APP_HREF.settingsSubscription, icon: "card-outline" },
  { key: "notificationStyle", href: APP_HREF.settingsNotifications, icon: "notifications-outline" },
] as const;

const DEV_LINKS = [
  { key: "devGallery", href: APP_HREF.settingsDevGallery, icon: "color-wand-outline" },
] as const;

export default function SettingsIndexScreen() {
  const { t, i18n } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const { data: tier, isLoading: tierLoading } = useTier(userId);
  const { preference, setPreference } = useTheme();
  const { colors, spacing } = useDesignTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [languageBusy, setLanguageBusy] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, []);

  const handleSetLanguage = useCallback(async (next: AppLocale) => {
    setLanguageBusy(next);
    try {
      await setAppLocale(next);
    } finally {
      setLanguageBusy(null);
    }
  }, []);

  const status = identity === undefined ? "loading" : "ready";
  const data = { ready: true as const };

  return (
    <>
      <Stack.Screen options={{ title: t("settings.title"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={data}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerStyle={{ paddingBottom: spacing[10] }}
          >
            <View className="px-5 pb-2 pt-4">
              <SectionHeading
                eyebrow={t("settings.systemPreferences")}
                title={t("settings.title")}
              />
              <Text className="mt-3 max-w-[320px] text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("settings.subtitle")}
              </Text>
            </View>

            <View className="mt-4 gap-4 px-5">
              <SurfaceCard className="px-4 py-4">
                <MetaLabel>{t("settings.backupStorage")}</MetaLabel>
                <Text className="mt-2 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
                  {tier?.tier ?? "FREE"}
                </Text>
                {tierLoading ? (
                  <View className="mt-4 flex-row items-center gap-3">
                    <ActivityIndicator color={colors.text} />
                    <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("common.loading")}
                    </Text>
                  </View>
                ) : tier ? (
                  <View className="mt-4">
                    <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                      {tier.storageLimitMb >= 0
                        ? t("settings.storageOf", {
                            used: formatStorageMb(tier.currentUsageMb),
                            limit: formatStorageMb(tier.storageLimitMb),
                          })
                        : t("settings.storageUsedUnlimited", {
                            used: formatStorageMb(tier.currentUsageMb),
                          })}
                    </Text>
                    {tier.storageLimitMb > 0 ? (
                      <View className="mt-3 h-2 overflow-hidden rounded-full bg-kyar-borderSubtle dark:bg-kyar-dark-borderSubtle">
                        <View
                          className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
                          style={{
                            width: `${Math.min(100, Math.max(6, (tier.currentUsageMb / tier.storageLimitMb) * 100))}%`,
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {t("settings.signInStorageHint")}
                  </Text>
                )}
              </SurfaceCard>

              <SurfaceCard className="px-4 py-4">
                <MetaLabel>{t("settings.profileIdentity")}</MetaLabel>

                <View className="mt-4 border-b border-kyar-borderSubtle pb-5 dark:border-kyar-dark-borderSubtle">
                  <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                    {t("settings.theme")}
                  </Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {(
                      [
                        ["system", t("settings.themeSystem")],
                        ["light", t("settings.themeLight")],
                        ["dark", t("settings.themeDark")],
                      ] as const
                    ).map(([value, label]) => (
                      <ChipButton
                        key={value}
                        label={label}
                        active={preference === value}
                        busyColor={colors.bg}
                        onPress={() => void setPreference(value as ThemePreference)}
                      />
                    ))}
                  </View>
                </View>

                <View className="pt-5">
                  <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                    {t("settings.language")}
                  </Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {SUPPORTED_LOCALES.map((locale) => (
                      <ChipButton
                        key={locale}
                        label={locale.toUpperCase()}
                        active={i18n.language === locale}
                        loading={languageBusy === locale}
                        busyColor={colors.bg}
                        onPress={() => void handleSetLanguage(locale)}
                      />
                    ))}
                  </View>
                </View>
              </SurfaceCard>

              <SurfaceCard className="overflow-hidden">
                <View className="px-4 pb-2 pt-4">
                  <MetaLabel>{t("settings.quickLinks")}</MetaLabel>
                </View>
                {SETTINGS_LINKS.map((item, index) => (
                  <SettingsRow
                    key={item.key}
                    icon={item.icon}
                    title={t(`settings.${item.key}`)}
                    subtitle={t("settings.opensInApp")}
                    onPress={() => undefined}
                    href={item.href}
                    iconColor={colors.text}
                    metaColor={colors.meta}
                    showBorder={index < SETTINGS_LINKS.length - 1}
                  />
                ))}
              </SurfaceCard>

              <SurfaceCard className="px-4 py-4">
                <MetaLabel>{t("settings.legalAndPolicies")}</MetaLabel>
                <Text className="mt-2 text-xs leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("settings.legalAndPoliciesSubtitle")}
                </Text>
                <View className="mt-4 gap-3">
                  <Pressable
                    onPress={() => void openWebAppPath("/terms", t)}
                    className="min-h-[44px] justify-center active:opacity-80"
                    accessibilityRole="link"
                    accessibilityLabel={t("settings.accountPage.termsOfService")}
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.termsOfService")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void openWebAppPath("/privacy", t)}
                    className="min-h-[44px] justify-center active:opacity-80"
                    accessibilityRole="link"
                    accessibilityLabel={t("settings.accountPage.privacyPolicy")}
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.privacyPolicy")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        "mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
                      )
                    }
                    className="min-h-[44px] justify-center active:opacity-80"
                    accessibilityRole="link"
                    accessibilityLabel={t("settings.accountPage.securitySupport")}
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.securitySupport")}
                    </Text>
                  </Pressable>
                </View>
              </SurfaceCard>

              <SurfaceCard className="overflow-hidden">
                <View className="px-4 pb-2 pt-4">
                  <MetaLabel>{t("settings.offlineSectionEyebrow")}</MetaLabel>
                </View>
                <SettingsRow
                  icon="cloud-offline-outline"
                  title={t("settings.offlineCapability")}
                  subtitle={t("settings.offlineCapabilitySubtitle")}
                  onPress={() => undefined}
                  href={APP_HREF.settingsOffline}
                  iconColor={colors.text}
                  metaColor={colors.meta}
                  showBorder
                />
                <SettingsRow
                  icon="download-outline"
                  title={t("settings.dataPortability")}
                  subtitle={t("settings.dataPortabilitySubtitle")}
                  onPress={() => undefined}
                  href={APP_HREF.settingsData}
                  iconColor={colors.text}
                  metaColor={colors.meta}
                  showBorder={false}
                />
              </SurfaceCard>

              {__DEV__ && (
                <SurfaceCard className="overflow-hidden">
                  <View className="px-4 pb-2 pt-4">
                    <MetaLabel>{t("settings.devLabs")}</MetaLabel>
                  </View>
                  {DEV_LINKS.map((item, index) => (
                    <SettingsRow
                      key={item.key}
                      icon={item.icon}
                      title={t(`settings.${item.key}`)}
                      subtitle={t(`settings.${item.key}Subtitle`)}
                      onPress={() => undefined}
                      href={item.href}
                      iconColor={colors.text}
                      metaColor={colors.meta}
                      showBorder={index < DEV_LINKS.length - 1}
                    />
                  ))}
                </SurfaceCard>
              )}

              <Pressable
                className="min-h-[52px] items-center justify-center rounded-full border border-kyar-danger/30 bg-kyar-surface px-5 active:opacity-90 dark:bg-kyar-dark-surface"
                onPress={() => void handleSignOut()}
                disabled={signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text className="text-sm font-semibold text-kyar-danger dark:text-kyar-dark-danger">
                    {t("common.signOut")}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}

function ChipButton({
  label,
  active,
  onPress,
  loading,
  busyColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  loading?: boolean;
  busyColor: string;
}) {
  return (
    <Pressable
      className={`min-h-[44px] min-w-[76px] items-center justify-center rounded-full border px-4 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={active ? busyColor : undefined} />
      ) : (
        <Text
          className={`text-xs font-semibold uppercase tracking-wide ${
            active
              ? "text-kyar-bg dark:text-kyar-dark-bg"
              : "text-kyar-text dark:text-kyar-dark-text"
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  loading,
  showBorder,
  href,
  iconColor,
  metaColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  showBorder?: boolean;
  href?: Href;
  iconColor: string;
  metaColor: string;
}) {
  const content = (
    <>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-kyar-muted dark:bg-kyar-dark-muted">
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">{title}</Text>
        <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={metaColor} />
      )}
    </>
  );

  const row = (
    <Pressable
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-kyar-muted/60 dark:active:bg-kyar-dark-muted/60 ${
        showBorder ? "border-b border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle" : ""
      }`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );

  if (href) {
    return (
      <Link href={href as never} asChild>
        {row}
      </Link>
    );
  }

  return row;
}
