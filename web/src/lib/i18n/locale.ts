/**
 * Client-side locale storage and validation for i18n.
 * Locale is stored in localStorage and must be in SUPPORTED_LOCALES.
 */

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "kyarafit-locale";

function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

/**
 * Returns the stored locale if valid; otherwise "en".
 */
export function getStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return "en";
}

/**
 * Persists locale to localStorage. Only allowlisted values are stored.
 */
export function setStoredLocale(locale: SupportedLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}
