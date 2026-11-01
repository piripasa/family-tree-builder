"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { isLocale } from "@/i18n/locale";

export function LanguageSwitch({ bare = false }: { bare?: boolean }) {
  const { locale, setLocale, messages } = useI18n();
  return (
    <label className={bare ? "language-switch is-bare" : "language-switch"}>
      {bare ? null : messages.language.label}
      <select
        aria-label={messages.language.label}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        <option value="en">English</option>
        <option value="bn">বাংলা</option>
      </select>
    </label>
  );
}
