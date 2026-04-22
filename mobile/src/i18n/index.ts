/* eslint-disable import/no-named-as-default-member -- use default i18next instance APIs */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import es from "./locales/es.json";

const LOCALE_KEY = "kyarafit.i18n.locale";

export const SUPPORTED_LOCALES = ["en", "ja", "es"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  en: { translation: en },
  ja: { translation: ja },
  es: { translation: es },
};

function normalizeLocale(raw: string | undefined): AppLocale {
  const code = (raw ?? "en").split("-")[0]?.toLowerCase() ?? "en";
  if (code === "ja") return "ja";
  if (code === "es") return "es";
  return "en";
}

function pickInitialLng(stored: string | null): AppLocale {
  if (stored === "en" || stored === "ja" || stored === "es") {
    return stored;
  }
  const device = Localization.getLocales()[0]?.languageCode;
  return normalizeLocale(device ?? undefined);
}

export async function initI18n(): Promise<void> {
  const stored = await SecureStore.getItemAsync(LOCALE_KEY);
  const lng = pickInitialLng(stored);

  await i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });
}

/** Persists to Secure Store and applies immediately (KFM-029a). */
export async function setAppLocale(next: AppLocale): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, next);
  await i18next.changeLanguage(next);
}

export default i18next;
