"use client";

import { createContext, useContext } from "react";
import type { SupportedLocale } from "./locale";

export type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocaleContext must be used within LocaleProvider");
  return value;
}

export { LocaleContext };
