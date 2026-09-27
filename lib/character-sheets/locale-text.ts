import { LOCALES, type Locale } from "./i18n-messages";

export type LocaleText = Partial<Record<Locale, string>>;

const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff]/;

export function localeTextFromString(text: string): LocaleText | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return CJK_RE.test(trimmed) ? { zh: trimmed } : { en: trimmed };
}

export function normalizeLocaleText(value: unknown): LocaleText | undefined {
  if (typeof value === "string") return localeTextFromString(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const next: LocaleText = {};
  for (const code of LOCALES) {
    const entry = (value as Record<string, unknown>)[code];
    if (typeof entry === "string" && entry.trim()) next[code] = entry.trim();
  }
  return Object.keys(next).length ? next : undefined;
}

export function resolveLocaleText(value: unknown, locale: Locale): string {
  if (typeof value === "string") return value;
  const map = normalizeLocaleText(value);
  if (!map) return "";
  for (const code of [locale, ...LOCALES.filter((item) => item !== locale)]) {
    const text = map[code];
    if (text) return text;
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUserFacingTextKey(key: string, parentKey: string) {
  if (key === "desc" || key === "description" || key === "effect") return true;
  return key === "text" && parentKey === "applied_on";
}

/** Walk preset DTO; convert plain user-facing copy to `{ en|zh|ja: text }`. Skips `name`. */
export function localizePresetUserFacingFields(node: unknown, parentKey = ""): void {
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "name") continue;
    if (isUserFacingTextKey(key, parentKey)) {
      const normalized = normalizeLocaleText(value);
      if (normalized) node[key] = normalized;
      else delete node[key];
      continue;
    }
    if (isRecord(value)) localizePresetUserFacingFields(value, key);
    else if (Array.isArray(value)) value.forEach((entry) => localizePresetUserFacingFields(entry, key));
  }
}

/** Resolve localized preset copy to plain strings for inventory wire (names unchanged). */
export function resolvePresetUserFacingFields(node: unknown, locale: Locale, parentKey = ""): void {
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "name") continue;
    if (isUserFacingTextKey(key, parentKey)) {
      const resolved = resolveLocaleText(value, locale);
      if (resolved) node[key] = resolved;
      else delete node[key];
      continue;
    }
    if (isRecord(value)) resolvePresetUserFacingFields(value, locale, key);
    else if (Array.isArray(value)) value.forEach((entry) => resolvePresetUserFacingFields(entry, locale, key));
  }
}
