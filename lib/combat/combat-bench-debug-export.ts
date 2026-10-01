import type { BenchTopOptionRow } from "./combat-bench-top-options.ts";
import type { CombatBenchSession } from "./combat-bench.ts";
import { planIntentRows } from "./combat-plan-intent.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";

export type CombatBenchRoundDebugJson = {
  exportedAt: string;
  randomSeed: number;
  stepLog: CombatBenchSession["stepLog"];
  combatRound: number;
  combatEnded: boolean;
  endReason: string | null;
  healthByPlacementId: CombatBenchSession["healthByPlacementId"];
  turnIndex: number;
  turnSequenceLength: number;
  currentTurn: CombatBenchSession["turnSequence"][number] | null;
  initiativeOrder: CombatBenchSession["initiativeOrder"];
  deciderPlacementId: string;
  placements: readonly CombatMapPlacement[];
  units: Record<
    string,
    {
      label: string;
      snapshot: unknown;
      plan: unknown;
      payloadSummary: {
        initiativeRounds: number;
        stanceCount: number;
        legalCells: number;
      };
      topOptions: readonly BenchTopOptionRow[];
      planIntentLines: string[];
    }
  >;
};

export function buildCombatBenchRoundDebugJson(input: {
  session: CombatBenchSession;
  placements: readonly CombatMapPlacement[];
  placementLabelById: ReadonlyMap<string, string>;
}): CombatBenchRoundDebugJson {
  const { session, placements, placementLabelById } = input;
  const currentTurn = session.turnSequence[session.turnIndex] ?? null;
  const units: CombatBenchRoundDebugJson["units"] = {};

  for (const p of placements) {
    const bundle = session.plansByPlacementId[p.id];
    if (!bundle) continue;
    let legalCells = 0;
    for (const x of bundle.payload.feasibility.legal) if (x === 1) legalCells++;
    units[p.id] = {
      label: p.label,
      snapshot: bundle.snapshot,
      plan: bundle.plan,
      payloadSummary: {
        initiativeRounds: bundle.payload.shape.initiativeRounds,
        stanceCount: bundle.payload.stancePositions.length,
        legalCells,
      },
      topOptions: session.topOptionsByPlacementId[p.id] ?? [],
      planIntentLines: planIntentRows(bundle.payload, bundle.plan, (targetId) =>
        targetId ? (placementLabelById.get(targetId) ?? targetId) : "",
      ).map((r) => r.text),
    };
  }

  return {
    exportedAt: new Date().toISOString(),
    randomSeed: session.randomSeed,
    stepLog: session.stepLog,
    combatRound: session.combatRound,
    combatEnded: session.combatEnded,
    endReason: session.endReason,
    healthByPlacementId: session.healthByPlacementId,
    turnIndex: session.turnIndex,
    turnSequenceLength: session.turnSequence.length,
    currentTurn,
    initiativeOrder: session.initiativeOrder,
    deciderPlacementId: session.deciderPlacementId,
    placements,
    units,
  };
}

export function serializeCombatBenchRoundDebug(json: CombatBenchRoundDebugJson): string {
  return JSON.stringify(json, null, 2);
}
