import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { benchHealthFromSheet } from "./combat-bench-health.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";

export type BenchPlacementHealthState = {
  current: number | null;
  max: number | null;
};

export function initBenchPlacementHealth(
  placements: readonly CombatMapPlacement[],
  sheetById: ReadonlyMap<string, CharacterSheet>,
): Record<string, BenchPlacementHealthState> {
  const out: Record<string, BenchPlacementHealthState> = {};
  for (const p of placements) {
    const view = benchHealthFromSheet(sheetById.get(p.sheetId), p.label);
    out[p.id] = {
      current: view?.simpleCurrent ?? null,
      max: view?.simpleMax ?? null,
    };
  }
  return out;
}

export function placementIsNeutralized(state: BenchPlacementHealthState | undefined): boolean {
  if (!state || state.current === null) return false;
  return state.current <= 0;
}

export type BenchCombatOutcome = {
  ended: boolean;
  winningTeam: CombatMapPlacement["team"] | null;
  reason: "ongoing" | "hostiles_neutralized" | "friendlies_neutralized" | "stalemate";
};

export function evaluateBenchCombatOutcome(
  placements: readonly CombatMapPlacement[],
  healthByPlacementId: Readonly<Record<string, BenchPlacementHealthState>>,
): BenchCombatOutcome {
  const hostiles = placements.filter((p) => p.team === "hostile");
  const friendlies = placements.filter((p) => p.team === "friendly");
  const hostileActive = hostiles.some((p) => !placementIsNeutralized(healthByPlacementId[p.id]));
  const friendlyActive = friendlies.some((p) => !placementIsNeutralized(healthByPlacementId[p.id]));

  if (hostiles.length > 0 && !hostileActive) {
    return { ended: true, winningTeam: "friendly", reason: "hostiles_neutralized" };
  }
  if (friendlies.length > 0 && !friendlyActive) {
    return { ended: true, winningTeam: "hostile", reason: "friendlies_neutralized" };
  }
  if (!hostileActive && !friendlyActive && placements.length > 0) {
    return { ended: true, winningTeam: null, reason: "stalemate" };
  }
  return { ended: false, winningTeam: null, reason: "ongoing" };
}
