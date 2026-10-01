import { cookies } from "next/headers";

import { LOCALES, type Locale } from "@/lib/character-sheets/i18n-messages";

import { loreLocaleDir, type LoreLocaleDir } from "./config";

export const LORE_LOCALE_COOKIE = "opcode.locale";

export async function getServerLoreLocaleDir(): Promise<LoreLocaleDir> {
  const stored = (await cookies()).get(LORE_LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(stored as Locale) ? (stored as Locale) : "en";
  return loreLocaleDir(locale);
}
