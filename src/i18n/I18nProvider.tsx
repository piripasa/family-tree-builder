"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { bn } from "./bn";
import { en, type Messages } from "./en";
import { LOCALE_COOKIE, type Locale } from "./locale";

type I18n = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale: initial, children }: { locale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initial);
  const value = useMemo<I18n>(() => {
    return {
      locale,
      messages: locale === "bn" ? bn : en,
      setLocale(next) {
        setLocaleState(next);
        document.documentElement.lang = next;
        document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      },
    };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("Language is unavailable.");
  return value;
}
