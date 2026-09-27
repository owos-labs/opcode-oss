import enSheets from "./messages.json";
import zhSheets from "./messages.zh.json";

export const LOCALES = ["en", "zh", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

type Dict = Record<string, string>;

export function flattenMessages(value: unknown, prefix = ""): Dict {
  if (typeof value === "string") return prefix ? { [prefix]: value } : {};
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      Object.entries(flattenMessages(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

export function buildMessageTables(chrome: Record<Locale, Dict>): Record<Locale, Dict> {
  const EN: Dict = {
    ...flattenMessages(enSheets),
    ...chrome.en,
    "common.close": "Close",
    "shared.phrases.deleteConfirm": "Delete?",
  };
  const ZH: Dict = { ...EN, ...flattenMessages(zhSheets), ...chrome.zh };
  const JA: Dict = { ...EN, ...chrome.ja };
  return { en: EN, zh: ZH, ja: JA };
}

export function messageForLocale(tables: Record<Locale, Dict>, locale: Locale, key: string) {
  return tables[locale][key] || tables.en[key] || key;
}
