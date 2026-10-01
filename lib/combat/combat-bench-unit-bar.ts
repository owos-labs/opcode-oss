import type { CombatBenchUnitStatusView } from "./combat-bench-unit-status.ts";
import type { CombatTurnStep, InitiativeRollEntry } from "./combat-bench-initiative.ts";

export type BenchUnitBarRow = {
  view: CombatBenchUnitStatusView;
  initiative: InitiativeRollEntry | null;
  /** 1-based initiative order when combat has started. */
  initiativeRank: number | null;
};

export function turnStepsForPlacement(
  turnSequence: readonly CombatTurnStep[],
  placementId: string,
): { step: CombatTurnStep; flatIndex: number }[] {
  const out: { step: CombatTurnStep; flatIndex: number }[] = [];
  for (let flatIndex = 0; flatIndex < turnSequence.length; flatIndex++) {
    const step = turnSequence[flatIndex];
    if (step && step.placementId === placementId) {
      out.push({ step, flatIndex });
    }
  }
  return out;
}

/** Exactly one row per placement; initiative order when `order` is non-empty. */
export function mergeBenchUnitBarRows(
  order: readonly InitiativeRollEntry[],
  rosterUnits: readonly CombatBenchUnitStatusView[],
): BenchUnitBarRow[] {
  const byId = new Map(rosterUnits.map((u) => [u.placementId, u]));
  const orderedIds: string[] = [];

  if (order.length > 0) {
    for (const entry of order) {
      if (!orderedIds.includes(entry.placementId)) {
        orderedIds.push(entry.placementId);
      }
    }
  } else {
    for (const view of rosterUnits) {
      if (!orderedIds.includes(view.placementId)) {
        orderedIds.push(view.placementId);
      }
    }
  }

  const rows: BenchUnitBarRow[] = [];
  for (const placementId of orderedIds) {
    const view = byId.get(placementId);
    if (!view) continue;
    const initiativeRank = order.length > 0 ? orderedIds.indexOf(placementId) + 1 : null;
    const initiative =
      order.find((e) => e.placementId === placementId) ?? null;
    rows.push({ view, initiative, initiativeRank });
  }
  return rows;
}
