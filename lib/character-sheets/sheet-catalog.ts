import type { OpcodeLocalSheet } from "./model";
import { normalizeLocalSheet } from "./model";

const COMBAT_SHEET_CACHE_KEY = "opcode.combat.sheetCache.v1";

export function mergeSheetsById(
  ...groups: readonly (readonly OpcodeLocalSheet[])[]
): OpcodeLocalSheet[] {
  const byId = new Map<string, OpcodeLocalSheet>();
  for (const group of groups) {
    for (const sheet of group) {
      byId.set(sheet.id, sheet);
    }
  }
  return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function readCombatBenchSheetCache(): OpcodeLocalSheet[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(COMBAT_SHEET_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeLocalSheet(entry))
      .filter((sheet): sheet is OpcodeLocalSheet => sheet !== null);
  } catch {
    return [];
  }
}

export function writeCombatBenchSheetCache(sheets: readonly OpcodeLocalSheet[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(COMBAT_SHEET_CACHE_KEY, JSON.stringify(sheets));
  } catch {
    // ponytail: quota — drop cache if full
  }
}

export function upsertCombatBenchSheetCache(sheet: OpcodeLocalSheet): void {
  writeCombatBenchSheetCache(mergeSheetsById(readCombatBenchSheetCache(), [sheet]));
}

export function syncCombatBenchSheetCacheFromOpfs(opfsSheets: readonly OpcodeLocalSheet[]): void {
  writeCombatBenchSheetCache(mergeSheetsById(readCombatBenchSheetCache(), opfsSheets));
}
