export const locales = ["en", "bn"] as const;

export type Locale = (typeof locales)[number];

export const LOCALE_COOKIE = "ftb_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "bn";
}
