import type { CharacterSheet, OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";

export const BENCH_HEALTH_PART_LABELS: Record<OpcodeHealthPart, string> = {
  head: "头部",
  torso: "躯干",
  hand_primary: "主手",
  hand_secondary: "副手",
  leg_left: "左腿",
  leg_right: "右腿",
};

export type BenchHealthPartRow = {
  key: OpcodeHealthPart;
  label: string;
  current: number | null;
  max: number;
};

export type BenchHealthView = {
  mode: "simple" | "normal";
  label: string;
  simpleCurrent: number | null;
  simpleMax: number | null;
  parts: BenchHealthPartRow[];
};

export function benchHealthFromSheet(
  sheet: CharacterSheet | undefined,
  placementLabel: string,
): BenchHealthView | null {
  if (!sheet) return null;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  if (summary.healthMode === "simple") {
    return {
      mode: "simple",
      label: placementLabel,
      simpleCurrent: summary.currentHealth,
      simpleMax: summary.maxHealth,
      parts: [],
    };
  }
  const parts: BenchHealthPartRow[] = [];
  for (const key of OPCODE_HEALTH_PARTS) {
    const row = summary.parts.find((p) => p.key === key);
    parts.push({
      key,
      label: BENCH_HEALTH_PART_LABELS[key],
      current: row?.current ?? null,
      max: row?.max ?? 0,
    });
  }
  return {
    mode: "normal",
    label: placementLabel,
    simpleCurrent: summary.currentHealth,
    simpleMax: summary.maxHealth,
    parts,
  };
}
