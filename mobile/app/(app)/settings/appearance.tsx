import { View, Text, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { type AppLocale, setAppLocale, SUPPORTED_LOCALES } from "@/i18n";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

const LANG_LABEL: Record<AppLocale, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
};

export default function AppearanceScreen() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();
  const activeLang =
    i18n.resolvedLanguage?.split("-")[0] ?? i18n.language.split("-")[0] ?? "en";

  return (
    <>
      <Stack.Screen options={{ title: t("settings.appearance") }} />
      <View className="flex-1 bg-white px-5 pt-6">
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
            className={`mb-2 rounded-xl border px-4 py-3 ${preference === value ? "border-violet-500 bg-violet-50" : "border-neutral-200 bg-neutral-50"}`}
            onPress={() => void setPreference(value as ThemePreference)}
            accessibilityRole="button"
            accessibilityState={{ selected: preference === value }}
          >
            <Text className="font-medium text-neutral-900">{label}</Text>
          </Pressable>
        ))}

        <Text className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("settings.language")}
        </Text>
        {SUPPORTED_LOCALES.map((lng) => {
          const selected = activeLang === lng;
          return (
            <Pressable
              key={lng}
              className={`mb-2 rounded-xl border px-4 py-3 active:opacity-90 ${
                selected ? "border-violet-500 bg-violet-50" : "border-neutral-200 bg-neutral-50"
              }`}
              onPress={() => void setAppLocale(lng)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text className="font-medium text-neutral-900">{LANG_LABEL[lng]}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
