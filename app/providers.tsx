"use client";

import type { ThemeProviderProps } from "next-themes";

import { ThemeProvider } from "next-themes";

import { I18nProvider } from "@/lib/character-sheets/i18n";

type ProvidersProps = {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
};

export function Providers({ children, themeProps }: ProvidersProps) {
  return (
    <ThemeProvider {...themeProps}>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
