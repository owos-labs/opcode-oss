import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { EMPTY_OPCODE_VITALS } from "../character-sheets/opcode-health-vitals.ts";
import type { BenchPlacementHealthState } from "./combat-bench-outcome.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";
import type { OpcodeSaveStats } from "./opcode-part-health.ts";

export function opcodeSaveStatsFromSheet(sheet: CharacterSheet | undefined): OpcodeSaveStats | undefined {
  if (!sheet) return undefined;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  return {
    wil: summary.baseStats.wil,
    bod: summary.baseStats.bod,
    fortitude: summary.fortitudeBonus,
  };
}

export function combatHealthFieldsFromBench(
  state: BenchPlacementHealthState | undefined,
  sheet: CharacterSheet | undefined,
): Pick<
  CombatTargetView,
  "healthMode" | "maxHp" | "parts" | "vitals" | "saveStats"
> {
  const summary = sheet ? readOpcodeSheetSummary(sheet.stats, sheet.status) : null;
  const mode = state?.mode ?? summary?.healthMode ?? "simple";
  if (mode !== "normal" || !state?.parts) {
    return {
      healthMode: mode === "normal" ? "normal" : "simple",
      maxHp: state?.max ?? summary?.maxHealth,
      vitals: state?.vitals ?? EMPTY_OPCODE_VITALS,
      saveStats: opcodeSaveStatsFromSheet(sheet),
    };
  }
  const parts: NonNullable<CombatTargetView["parts"]> = {};
  for (const key of OPCODE_HEALTH_PARTS) {
    const row = state.parts[key];
    parts[key] = {
      current: row.current,
      max: row.max,
      destroyed: row.destroyed,
      severed: row.severed,
    };
  }
  return {
    healthMode: "normal",
    maxHp: state.max ?? summary?.maxHealth,
    parts,
    vitals: state.vitals ?? EMPTY_OPCODE_VITALS,
    saveStats: opcodeSaveStatsFromSheet(sheet),
  };
}

export function attachActorHealthToSnapshot(
  snapshot: CombatSnapshot,
  state: BenchPlacementHealthState | undefined,
  sheet: CharacterSheet | undefined,
): CombatSnapshot {
  const fields = combatHealthFieldsFromBench(state, sheet);
  return {
    ...snapshot,
    healthMode: fields.healthMode ?? snapshot.healthMode,
    maxHp: fields.maxHp ?? snapshot.maxHp,
    parts: fields.parts ?? snapshot.parts,
    vitals: fields.vitals ?? snapshot.vitals,
    saveStats: fields.saveStats ?? snapshot.saveStats,
  };
}
