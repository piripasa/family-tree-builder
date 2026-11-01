import type { Metadata } from "next";
import { Fraunces, Noto_Sans_Bengali, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/I18nProvider";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { readLocale } from "@/i18n/serverLocale";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  display: "swap",
  variable: "--font-bengali",
});

export async function generateMetadata(): Promise<Metadata> {
  const messages = (await readLocale()) === "bn" ? bn : en;
  return {
    title: messages.appName,
    description: messages.meta.description,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await readLocale();
  return (
    <html lang={locale} className={`${sans.variable} ${display.variable} ${bengali.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
