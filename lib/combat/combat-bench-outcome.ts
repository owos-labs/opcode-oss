import type {
  CharacterSheet,
  OpcodeHealthPart,
} from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
import {
  EMPTY_OPCODE_VITALS,
  opcodePlacementIncapacitated,
  readOpcodeVitalsFromStatusHealth,
  type OpcodeVitalsState,
} from "../character-sheets/opcode-health-vitals.ts";
import { benchHealthFromSheet } from "./combat-bench-health.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";

export type BenchPlacementPartHealth = {
  current: number;
  max: number;
  destroyed?: boolean;
  severed?: boolean;
  postDestroyDamage?: number;
};

export type BenchPlacementHealthState = {
  mode?: "simple" | "normal";
  current: number | null;
  max: number | null;
  parts?: Record<OpcodeHealthPart, BenchPlacementPartHealth>;
  vitals?: OpcodeVitalsState;
};

export function initBenchPlacementHealth(
  placements: readonly CombatMapPlacement[],
  sheetById: ReadonlyMap<string, CharacterSheet>,
): Record<string, BenchPlacementHealthState> {
  const out: Record<string, BenchPlacementHealthState> = {};
  for (const p of placements) {
    const sheet = sheetById.get(p.sheetId);
    const view = benchHealthFromSheet(sheet, p.label);
    const statusHealth =
      sheet && sheet.status && typeof sheet.status === "object" && !Array.isArray(sheet.status)
        ? (sheet.status as Record<string, unknown>).health
        : undefined;
    const vitals = sheet
      ? readOpcodeVitalsFromStatusHealth(
          statusHealth && typeof statusHealth === "object" && !Array.isArray(statusHealth)
            ? (statusHealth as Record<string, unknown>)
            : {},
        )
      : EMPTY_OPCODE_VITALS;
    if (!view) {
      out[p.id] = { mode: "simple", current: null, max: null, vitals };
      continue;
    }
    if (view.mode === "simple") {
      out[p.id] = {
        mode: "simple",
        current: view.simpleCurrent,
        max: view.simpleMax,
        vitals,
      };
      continue;
    }
    const parts = {} as Record<OpcodeHealthPart, BenchPlacementPartHealth>;
    for (const key of OPCODE_HEALTH_PARTS) {
      const row = view.parts.find((part) => part.key === key);
      const max = row?.max ?? 0;
      const current = row?.current ?? max;
      parts[key] = {
        max,
        current,
        destroyed: current <= 0,
        severed: false,
        postDestroyDamage: 0,
      };
    }
    out[p.id] = {
      mode: "normal",
      current: view.simpleCurrent,
      max: view.simpleMax,
      parts,
      vitals,
    };
  }
  return out;
}

export function placementIsNeutralized(state: BenchPlacementHealthState | undefined): boolean {
  if (!state || state.current === null) return false;
  if (opcodePlacementIncapacitated({ current: state.current, vitals: state.vitals })) {
    return true;
  }
  return state.current <= 0;
}

export type BenchCombatOutcome = {
  ended: boolean;
  winningTeam: CombatMapPlacement["team"] | null;
  reason:
    | "ongoing"
    | "hostiles_neutralized"
    | "friendlies_neutralized"
    | "faction_eliminated"
    | "stalemate";
};

function teamHasLiving(
  placements: readonly CombatMapPlacement[],
  team: string,
  healthByPlacementId: Readonly<Record<string, BenchPlacementHealthState>>,
): boolean {
  return placements.some(
    (p) => p.team === team && !placementIsNeutralized(healthByPlacementId[p.id]),
  );
}

/** Distinct teams fight until one remains. A solo roster stays in play for hunt/patrol. */
export function evaluateBenchCombatOutcome(
  placements: readonly CombatMapPlacement[],
  healthByPlacementId: Readonly<Record<string, BenchPlacementHealthState>>,
): BenchCombatOutcome {
  const teams = [...new Set(placements.map((p) => p.team))];
  const activeTeams = teams.filter((team) =>
    teamHasLiving(placements, team, healthByPlacementId),
  );

  if (activeTeams.length >= 2) {
    return { ended: false, winningTeam: null, reason: "ongoing" };
  }
  if (teams.length <= 1 && activeTeams.length === 1) {
    return { ended: false, winningTeam: null, reason: "ongoing" };
  }
  if (activeTeams.length === 1) {
    const winner = activeTeams[0]!;
    const reason =
      winner === "friendly"
        ? "hostiles_neutralized"
        : winner === "hostile"
          ? "friendlies_neutralized"
          : "faction_eliminated";
    return { ended: true, winningTeam: winner, reason };
  }
  if (placements.length > 0) {
    return { ended: true, winningTeam: null, reason: "stalemate" };
  }
  return { ended: false, winningTeam: null, reason: "ongoing" };
}
