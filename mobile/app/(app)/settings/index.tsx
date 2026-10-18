import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { Link, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { formatStorageMb } from "@kyarafit/design-system/domain/cloudStoragePolicy";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { isPaidTier, normalizeTier } from "@kyarafit/design-system/domain/entitlements";
import { setAppLocale, SUPPORTED_LOCALES, type AppLocale } from "@/i18n";
import { APP_HREF } from "@/lib/appRoutes";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { signOut } from "@/lib/auth/client";
import { useTier } from "@/lib/useTier";
import { useTheme } from "@/theme/ThemeProvider";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassSheet, PhotoPill } from "@/ui/glass";
import {
  SettingsGlassFrame,
  SettingsGlassLabel,
  SettingsGlassSection,
  settingsGlassStyles as styles,
} from "@/screens/settings/glassSettings";

const SETTINGS_LINKS = [
  { key: "accountDetails", href: APP_HREF.settingsAccount, icon: "person-circle-outline" },
  { key: "subscriptionPlan", href: APP_HREF.settingsSubscription, icon: "card-outline" },
  { key: "notificationStyle", href: APP_HREF.settingsNotifications, icon: "notifications-outline" },
  { key: "dataPortability", href: APP_HREF.settingsData, icon: "download-outline" },
  { key: "offlineCapability", href: APP_HREF.settingsOffline, icon: "cloud-offline-outline" },
] as const;

export default function SettingsIndexScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const { data: tier, isLoading: tierLoading } = useTier(userId);
  const { preference, setPreference } = useTheme();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOutInFlight = useRef(false);
  const [languageBusy, setLanguageBusy] = useState<string | null>(null);
  const canUseCloudSync = shouldRunSyncWorker(tier?.tier ?? null, Boolean(userId));
  // Unknown/free tiers receive the conservative export warning, never an assurance of cloud backup.
  const warnBeforeSignOut = !isPaidTier(normalizeTier(tier?.tier));

  const handleSignOut = useCallback(async () => {
    if (signOutInFlight.current) return;
    signOutInFlight.current = true;
    setSigningOut(true);
    try {
      await signOut();
      setSignOutOpen(false);
    } catch {
      Alert.alert(
        t("common.errorTitle"),
        t("settings.signOutError", { defaultValue: "Could not sign out. Please try again." })
      );
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }, [t]);

  const handleSetLanguage = useCallback(async (next: AppLocale) => {
    setLanguageBusy(next);
    try {
      await setAppLocale(next);
    } finally {
      setLanguageBusy(null);
    }
  }, []);

  return (
    <SettingsGlassFrame eyebrow={t("settings.systemPreferences")} title={t("settings.title")}>
      <DataBoundary
        status={identity === undefined ? "loading" : "ready"}
        data={{ ready: true as const }}
      >
        {() => (
          <>
            <SettingsGlassSection label={t("settings.backupStorage")}>
              <Text style={styles.value}>
                {t(`settings.tierName.${normalizeTier(tier?.tier).toUpperCase()}`)}
              </Text>
              {tierLoading ? (
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <ActivityIndicator color={glass.text.fg} />
                  <Text style={styles.body}>{t("common.loading")}</Text>
                </View>
              ) : tier ? (
                <>
                  <Text style={styles.body}>
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
                    <View style={{ height: 3, backgroundColor: glass.border.divider }}>
                      <View
                        style={{
                          height: 3,
                          backgroundColor: glass.text.fg70,
                          width: `${Math.min(100, Math.max(6, (tier.currentUsageMb / tier.storageLimitMb) * 100))}%`,
                        }}
                      />
                    </View>
                  ) : null}
                  {!canUseCloudSync ? (
                    <View
                      style={{
                        borderTopWidth: borderWidth.hairline,
                        borderTopColor: glass.border.divider,
                        paddingTop: 16,
                        gap: 8,
                      }}
                    >
                      <Text style={styles.body}>
                        {t("settings.cloudBackupUpgrade", {
                          defaultValue: "Upgrade for automatic cloud sync and backup.",
                        })}
                      </Text>
                      <Link href={APP_HREF.settingsSubscription} asChild>
                        <PhotoPill variant="text" label={t("settings.subscriptionPlan")} />
                      </Link>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.body}>{t("settings.signInStorageHint")}</Text>
              )}
            </SettingsGlassSection>

            <SettingsGlassSection label={t("settings.profileIdentity")}>
              <SettingsGlassLabel>{t("settings.appearance")}</SettingsGlassLabel>
              <ScrollView
                horizontal
                accessibilityRole="radiogroup"
                accessibilityLabel={t("settings.appearance")}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
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
                    onPress={() => void setPreference(value)}
                  />
                ))}
              </ScrollView>
              <View style={{ marginTop: 8, gap: 12 }}>
                <SettingsGlassLabel>{t("settings.language")}</SettingsGlassLabel>
                <ScrollView
                  horizontal
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("settings.language")}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {SUPPORTED_LOCALES.map((locale) => (
                    <ChipButton
                      key={locale}
                      label={locale.toUpperCase()}
                      active={i18n.language.split("-")[0] === locale}
                      loading={languageBusy === locale}
                      disabled={languageBusy !== null}
                      onPress={() => void handleSetLanguage(locale)}
                    />
                  ))}
                </ScrollView>
              </View>
              <View style={{ marginTop: 8 }}>
                {SETTINGS_LINKS.map((item) => (
                  <SettingsRow
                    key={item.key}
                    icon={item.icon}
                    title={t(`settings.${item.key}`)}
                    href={item.href}
                  />
                ))}
              </View>
            </SettingsGlassSection>

            <SettingsGlassSection label={t("settings.legalAndPolicies")}>
              <Text style={styles.body}>{t("settings.legalAndPoliciesSubtitle")}</Text>
              <PhotoPill
                variant="text"
                accessibilityRole="link"
                label={t("settings.accountPage.termsOfService")}
                onPress={() => void openWebAppPath("/terms", t)}
              />
              <PhotoPill
                variant="text"
                accessibilityRole="link"
                label={t("settings.accountPage.privacyPolicy")}
                onPress={() => void openWebAppPath("/privacy", t)}
              />
              <PhotoPill
                variant="text"
                accessibilityRole="link"
                label={t("settings.accountPage.securitySupport")}
                onPress={() =>
                  void Linking.openURL(
                    "mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
                  )
                }
              />
            </SettingsGlassSection>

            {__DEV__ ? (
              <SettingsGlassSection label={t("settings.devLabs")}>
                <SettingsRow
                  icon="color-wand-outline"
                  title={t("settings.devGallery")}
                  href={APP_HREF.settingsDevGallery}
                />
              </SettingsGlassSection>
            ) : null}

            <SettingsGlassSection>
              <SignOutAction
                label={t("common.signOut")}
                disabled={signingOut || tierLoading}
                onPress={() => setSignOutOpen(true)}
              />
            </SettingsGlassSection>
          </>
        )}
      </DataBoundary>
      <GlassSheet
        open={signOutOpen}
        closeLabel={t("common.cancel")}
        onClose={() => {
          if (!signingOut) setSignOutOpen(false);
        }}
      >
        <View accessibilityViewIsModal style={{ padding: 22, gap: 18 }}>
          <Text accessibilityRole="header" style={styles.value}>
            {t("settings.signOutConfirmTitle", { defaultValue: "Sign out of Kyarafit?" })}
          </Text>
          <Text style={styles.body}>
            {warnBeforeSignOut
              ? t("settings.signOutExportWarning", {
                  defaultValue:
                    "Your data stays on this device. Export it before signing out: another account signing in on this device may replace it.",
                })
              : t("settings.signOutConfirmBody", {
                  defaultValue:
                    "Your local data stays on this device. Are you sure you want to sign out?",
                })}
          </Text>
          {warnBeforeSignOut ? (
            <PhotoPill
              label={t("settings.dataExportButton")}
              disabled={signingOut}
              onPress={() => {
                setSignOutOpen(false);
                router.push(APP_HREF.settingsData);
              }}
            />
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <PhotoPill
              variant="outline"
              label={t("common.cancel")}
              disabled={signingOut}
              onPress={() => setSignOutOpen(false)}
            />
            <SignOutAction
              label={t("common.signOut")}
              disabled={signingOut}
              onPress={() => void handleSignOut()}
            />
            {signingOut ? (
              <ActivityIndicator accessibilityLabel={t("common.loading")} color={glass.text.fg} />
            ) : null}
          </View>
        </View>
      </GlassSheet>
    </SettingsGlassFrame>
  );
}

function SignOutAction({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        minHeight: 44,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 22,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: glass.text.danger,
        backgroundColor: glass.surface.bar,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name="log-out-outline" size={15} color={glass.text.danger} />
      <Text
        style={{
          color: glass.text.danger,
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 10,
          letterSpacing: ls(0.16, 10),
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipButton({
  label,
  active,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: active, disabled: Boolean(disabled), busy: Boolean(loading) }}
      className="active:opacity-80"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        minWidth: 76,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? glass.surface.solid : glass.border.strong,
        backgroundColor: active ? glass.surface.solid : glass.surface.bar,
        paddingHorizontal: 16,
      }}
    >
      {loading ? (
        <ActivityIndicator color={active ? glass.text.ink : glass.text.fg} />
      ) : (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 10,
            letterSpacing: ls(0.16, 10),
            textTransform: "uppercase",
            color: active ? glass.text.ink : glass.text.fg70,
          }}
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
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        className="active:opacity-80"
        style={StyleSheet.flatten({
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: borderWidth.hairline,
          borderBottomColor: glass.border.divider,
        })}
      >
        <Ionicons name={icon} size={18} color={glass.text.fg70} />
        <Text style={[styles.body, { flex: 1, color: glass.text.fg }]}>{title}</Text>
        <Ionicons name="chevron-forward" size={16} color={glass.text.fg70} />
      </Pressable>
    </Link>
  );
}
