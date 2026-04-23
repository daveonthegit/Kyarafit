import { View, Text, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { type AppLocale, setAppLocale, SUPPORTED_LOCALES } from "@/i18n";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { useDesignTheme } from "@/theme/useDesignTheme";

const LANG_LABEL: Record<AppLocale, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
};

export default function AppearanceScreen() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { colors } = useDesignTheme();
  const activeLang = i18n.resolvedLanguage?.split("-")[0] ?? i18n.language.split("-")[0] ?? "en";

  return (
    <>
      <Stack.Screen
        options={{
          title: t("settings.appearance"),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.bg },
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <View className="flex-1 bg-kyar-bg px-5 pt-6 dark:bg-kyar-dark-bg">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
          {t("settings.theme")}
        </Text>
        {(
          [
            ["system", t("settings.themeSystem")] as const,
            ["light", t("settings.themeLight")] as const,
            ["dark", t("settings.themeDark")] as const,
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            className={`mb-2 rounded-xl border px-4 py-3 active:opacity-90 ${
              preference === value
                ? "border-kyar-accent bg-kyar-accentSoft dark:border-kyar-dark-accent dark:bg-kyar-dark-accentSoft"
                : "border-kyar-border bg-kyar-surface dark:border-kyar-dark-border dark:bg-kyar-dark-surface"
            }`}
            onPress={() => void setPreference(value as ThemePreference)}
            accessibilityRole="button"
            accessibilityState={{ selected: preference === value }}
          >
            <Text className="font-medium text-kyar-text dark:text-kyar-dark-text">{label}</Text>
          </Pressable>
        ))}

        <Text className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
          {t("settings.language")}
        </Text>
        {SUPPORTED_LOCALES.map((lng) => {
          const selected = activeLang === lng;
          return (
            <Pressable
              key={lng}
              className={`mb-2 rounded-xl border px-4 py-3 active:opacity-90 ${
                selected
                  ? "border-kyar-accent bg-kyar-accentSoft dark:border-kyar-dark-accent dark:bg-kyar-dark-accentSoft"
                  : "border-kyar-border bg-kyar-surface dark:border-kyar-dark-border dark:bg-kyar-dark-surface"
              }`}
              onPress={() => void setAppLocale(lng)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text className="font-medium text-kyar-text dark:text-kyar-dark-text">
                {LANG_LABEL[lng]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
