"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { LocaleContext } from "@/lib/i18n/context";
import { getStoredLocale, setStoredLocale, type SupportedLocale } from "@/lib/i18n/locale";

import en from "../../messages/en.json";
import es from "../../messages/es.json";

const messagesMap: Record<SupportedLocale, typeof en> = {
  en: en as typeof en,
  es: es as typeof en,
};

type Props = { children: React.ReactNode };

export function LocaleProvider({ children }: Props) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const messages = useMemo(() => messagesMap[locale], [locale]);
  const contextValue = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={contextValue}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
