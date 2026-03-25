import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./locales/en.json";
import es from "./locales/es.json";

export const LANGUAGE_STORAGE_KEY = "kyarafit_app_language";

const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;

function deviceDefault(): "en" | "es" {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === "es" ? "es" : "en";
}

/** Synchronous bootstrap so first render has translations (before AsyncStorage hydrate). */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    resources,
    lng: deviceDefault(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

let hydrated = false;

/** Hydrate preferred language from storage (call once at startup). */
export async function initI18n(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "es" || saved === "en") {
    await i18n.changeLanguage(saved);
  }
}

export async function setAppLanguage(lng: "en" | "es"): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  await i18n.changeLanguage(lng);
}

export default i18n;
