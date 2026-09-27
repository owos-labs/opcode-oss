import type { ActionIntent } from "../combat-ai/search.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { describePlanStep as describePlanStepText } from "./combat-plan-intent.ts";
import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { decideRoundPlanWithSimulation } from "./decide-with-simulation.ts";
import { createPlanningBundle, prepareOptionsForSearch } from "../combat-ai/planning.ts";
import { buildPlanningPayload, type PlanningPayload } from "./build-planning-payload.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import { combatSnapshotFromCharacterSheet } from "./character-sheet-snapshot.ts";
import { parseSvgViewBox } from "./combat-test-scene.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import {
  buildCombatTurnSequence,
  maxPlanInitiativeSlot,
  placementProfileId,
  rollInitiativeOrder,
  type CombatTurnStep,
  type InitiativeRollEntry,
} from "./combat-bench-initiative.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import {
  evaluateBenchCombatOutcome,
  initBenchPlacementHealth,
  type BenchCombatOutcome,
} from "./combat-bench-outcome.ts";
import { initiativeCostOfStandardAction } from "./initiative.ts";
import {
  topScoredOptionRows,
  type BenchTopOptionRow,
} from "./combat-bench-top-options.ts";

export const BENCH_TOP_OPTIONS_N = 5;

export type { CombatBenchTeam, CombatMapPlacement } from "./combat-bench-placements.ts";
export {
  benchStartValidation,
  defaultDeciderPlacementId,
  dropPointFromClientOffset,
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
} from "./combat-bench-placements.ts";

export type PlacementBenchPlan = {
  snapshot: CombatSnapshot;
  payload: PlanningPayload;
  plan: RoundPlan;
};

export type CombatBenchSession = {
  deciderPlacementId: string;
  randomSeed: number;
  /** Turn order after REF+1d6 (seeded). */
  initiativeOrder: InitiativeRollEntry[];
  /** Flat sequence: each entry = one NPC's actions in one initiative segment. */
  turnSequence: CombatTurnStep[];
  turnIndex: number;
  plansByPlacementId: Record<string, PlacementBenchPlan>;
  topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]>;
  /** Current 3-second combat round (1.7). */
  combatRound: number;
  healthByPlacementId: Record<string, import("./combat-bench-outcome.ts").BenchPlacementHealthState>;
  combatEnded: boolean;
  endReason: BenchCombatOutcome["reason"] | null;
};

export function activePlacementPlan(session: CombatBenchSession): PlacementBenchPlan | null {
  const turn = session.turnSequence[session.turnIndex];
  if (!turn) return session.plansByPlacementId[session.deciderPlacementId] ?? null;
  return session.plansByPlacementId[turn.placementId] ?? null;
}

export { actionKindLabel, describePlanStep, planIntentRows, type PlanIntentRow } from "./combat-plan-intent.ts";

export function buildBenchSnapshot(input: {
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  deciderPlacementId: string;
  profileId?: NpcDifficultyId;
}): CombatSnapshot {
  const decider = input.placements.find((p) => p.id === input.deciderPlacementId);
  if (!decider) throw new Error("decider placement missing");
  const profileId = input.profileId ?? placementProfileId(decider);
  const npcSheet = input.sheetById.get(decider.sheetId);
  if (!npcSheet) throw new Error("decider sheet missing");

  const targets: CombatTargetView[] = input.placements
    .filter((p) => p.id !== decider.id)
    .map((p) => ({
      id: p.id,
      position: { x: p.x, y: p.y },
      localization: "full" as const,
      armorByPart: targetArmorFromSheet(input.sheetById.get(p.sheetId)),
      coverId: null,
    }));

  return combatSnapshotFromCharacterSheet(npcSheet, {
    actorId: decider.id,
    position: { x: decider.x, y: decider.y },
    targets,
    encounter: {
      profileId,
      allowNpcSurrender: false,
      surrenderThreshold: -Infinity,
    },
  });
}

function targetArmorFromSheet(sheet: CharacterSheet | undefined): Record<string, number> {
  if (!sheet) return { torso: 0 };
  const inventory = sheet.status?.inventory;
  if (!Array.isArray(inventory)) return { torso: 0 };
  for (const item of inventory) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.type !== "armor") continue;
    const armor = rec.armor as Record<string, unknown> | undefined;
    const normal = armor?.protection as Record<string, unknown> | undefined;
    const parts = normal?.normal as Record<string, unknown> | undefined;
    if (!parts) continue;
    const torso = Number(parts.torso);
    return { torso: Number.isFinite(torso) ? torso : 0 };
  }
  return { torso: 0 };
}

export function buildPlacementPlans(input: {
  map: CompiledCombatMap;
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  topN?: number;
}): {
  plansByPlacementId: Record<string, PlacementBenchPlan>;
  topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]>;
  maxSlotByPlacementId: Record<string, number>;
} {
  const topN = input.topN ?? BENCH_TOP_OPTIONS_N;
  const labelById = new Map(input.placements.map((p) => [p.id, p.label]));
  const plansByPlacementId: Record<string, PlacementBenchPlan> = {};
  const topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]> = {};
  const maxSlotByPlacementId: Record<string, number> = {};

  for (const p of input.placements) {
    try {
      const snapshot = buildBenchSnapshot({
        sheetById: input.sheetById,
        placements: input.placements,
        deciderPlacementId: p.id,
      });
      const payload = buildPlanningPayload(snapshot, input.map);
      const plan = decideRoundPlanWithSimulation({
        profileId: snapshot.encounter.profileId,
        feasibility: payload.feasibility,
        utility: payload.utility,
        randomSeed: input.randomSeed,
        snapshotVersion: snapshot.snapshotVersion,
        allowNpcSurrender: snapshot.encounter.allowNpcSurrender,
        surrenderThreshold: snapshot.encounter.surrenderThreshold,
        snapshot,
        payload,
      });
      plansByPlacementId[p.id] = { snapshot, payload, plan };
      maxSlotByPlacementId[p.id] = maxPlanInitiativeSlot(plan);
      const bundle = createPlanningBundle({
        profileId: snapshot.encounter.profileId,
        feasibility: payload.feasibility,
        utility: payload.utility,
        randomSeed: input.randomSeed,
        snapshotVersion: snapshot.snapshotVersion,
        allowNpcSurrender: snapshot.encounter.allowNpcSurrender,
        surrenderThreshold: snapshot.encounter.surrenderThreshold,
      });
      const options = prepareOptionsForSearch(bundle);
      topOptionsByPlacementId[p.id] = topScoredOptionRows(payload, options, topN, (targetId) =>
        targetId ? (labelById.get(targetId) ?? targetId.slice(0, 8)) : "",
      );
    } catch {
      topOptionsByPlacementId[p.id] = [];
      maxSlotByPlacementId[p.id] = -1;
    }
  }
  return { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId };
}

/** @deprecated use buildPlacementPlans */
export function buildTopOptionsByPlacement(input: {
  map: CompiledCombatMap;
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  topN?: number;
}): Record<string, readonly BenchTopOptionRow[]> {
  return buildPlacementPlans(input).topOptionsByPlacementId;
}

export function startCombatBenchSession(input: {
  map: CompiledCombatMap;
  deciderPlacementId: string;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  randomSeed?: number;
}): CombatBenchSession {
  const randomSeed = input.randomSeed ?? 42;
  const { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId } = buildPlacementPlans({
    map: input.map,
    sheetById: input.sheetById,
    placements: input.placements,
    randomSeed,
  });
  const initiativeOrder = rollInitiativeOrder({
    placements: input.placements,
    sheetById: input.sheetById,
    deciderPlacementId: input.deciderPlacementId,
    randomSeed,
  });
  const turnSequence = buildCombatTurnSequence(initiativeOrder, maxSlotByPlacementId);
  const healthByPlacementId = initBenchPlacementHealth(input.placements, input.sheetById);
  const outcome = evaluateBenchCombatOutcome(input.placements, healthByPlacementId);

  return {
    deciderPlacementId: input.deciderPlacementId,
    randomSeed,
    initiativeOrder,
    turnSequence,
    turnIndex: 0,
    plansByPlacementId,
    topOptionsByPlacementId,
    combatRound: 1,
    healthByPlacementId,
    combatEnded: outcome.ended,
    endReason: outcome.ended ? outcome.reason : null,
  };
}

export function benchCombatEndLabel(reason: BenchCombatOutcome["reason"]): string {
  if (reason === "hostiles_neutralized") return "战斗结束：敌方已无害化";
  if (reason === "friendlies_neutralized") return "战斗结束：友方已无害化";
  if (reason === "stalemate") return "战斗结束：双方均无害化";
  return "战斗结束";
}

export function placementPositionsFromSession(
  session: CombatBenchSession,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, bundle] of Object.entries(session.plansByPlacementId)) {
    out[id] = { x: bundle.snapshot.position.x, y: bundle.snapshot.position.y };
  }
  return out;
}

/** Start next 3s combat round: reset per-round mov/initiative and replan from live positions. */
export function advanceCombatBenchRound(input: {
  session: CombatBenchSession;
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
}): CombatBenchSession {
  const outcome = evaluateBenchCombatOutcome(
    input.placements,
    input.session.healthByPlacementId,
  );
  if (outcome.ended) {
    return {
      ...input.session,
      combatEnded: true,
      endReason: outcome.reason,
    };
  }

  const placementsWithPositions = input.placements.map((p) => {
    const pos = input.session.plansByPlacementId[p.id]?.snapshot.position;
    return pos ? { ...p, x: pos.x, y: pos.y } : p;
  });

  const { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId } = buildPlacementPlans(
    {
      map: input.map,
      sheetById: input.sheetById,
      placements: placementsWithPositions,
      randomSeed: input.session.randomSeed,
    },
  );

  for (const id of Object.keys(plansByPlacementId)) {
    const bundle = plansByPlacementId[id]!;
    plansByPlacementId[id] = {
      ...bundle,
      snapshot: {
        ...bundle.snapshot,
        metersMovedThisRound: 0,
        initiativeRemaining: bundle.snapshot.initiativeTotal,
      },
    };
  }

  const turnSequence = buildCombatTurnSequence(
    input.session.initiativeOrder,
    maxSlotByPlacementId,
  );

  return {
    ...input.session,
    combatRound: input.session.combatRound + 1,
    plansByPlacementId,
    topOptionsByPlacementId,
    turnSequence,
    turnIndex: 0,
  };
}

export { applyPlanStepToSnapshot } from "./apply-plan-step.ts";

export type StepBenchResult = {
  session: CombatBenchSession;
  label: string;
  actorPlacementId: string;
  actorPosition: { x: number; y: number };
  /** True only when combat ends (side neutralized), not when a 3s round completes. */
  done: boolean;
  newCombatRound?: number;
};

function spendInitiativeForSlot(snapshot: CombatSnapshot, slot: number): CombatSnapshot {
  const cost = initiativeCostOfStandardAction(slot);
  return {
    ...snapshot,
    initiativeRemaining: Math.max(0, snapshot.initiativeRemaining - cost),
  };
}

/** Re-decide with current map positions while keeping spent ammo / initiative / movement. */
export function replanPlacementTurn(input: {
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placementId: string;
  prior: PlacementBenchPlan;
  randomSeed: number;
}): PlacementBenchPlan {
  const fresh = buildBenchSnapshot({
    sheetById: input.sheetById,
    placements: input.placements,
    deciderPlacementId: input.placementId,
  });
  const snapshot: CombatSnapshot = {
    ...fresh,
    initiativeRemaining: input.prior.snapshot.initiativeRemaining,
    initiativeTotal: input.prior.snapshot.initiativeTotal,
    metersMovedThisRound: input.prior.snapshot.metersMovedThisRound,
    ammo: input.prior.snapshot.ammo,
    sustainedFire: input.prior.snapshot.sustainedFire,
    suppressionActive: input.prior.snapshot.suppressionActive,
  };
  const payload = buildPlanningPayload(snapshot, input.map);
  const plan = decideRoundPlanWithSimulation({
    profileId: snapshot.encounter.profileId,
    feasibility: payload.feasibility,
    utility: payload.utility,
    randomSeed: input.randomSeed,
    snapshotVersion: snapshot.snapshotVersion,
    allowNpcSurrender: snapshot.encounter.allowNpcSurrender,
    surrenderThreshold: snapshot.encounter.surrenderThreshold,
    snapshot,
    payload,
  });
  return { snapshot, payload, plan };
}

export function stepCombatBenchSession(
  session: CombatBenchSession,
  context: {
    map: CompiledCombatMap;
    placements: readonly CombatMapPlacement[];
    sheetById: ReadonlyMap<string, CharacterSheet>;
  },
): StepBenchResult {
  if (session.combatEnded) {
    const fallback =
      session.plansByPlacementId[session.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
    return {
      session,
      label: benchCombatEndLabel(session.endReason ?? "stalemate"),
      actorPlacementId: session.deciderPlacementId,
      actorPosition: fallback,
      done: true,
    };
  }

  let working = session;
  let newCombatRound: number | undefined;
  if (working.turnIndex >= working.turnSequence.length) {
    working = advanceCombatBenchRound({
      session: working,
      map: context.map,
      placements: context.placements,
      sheetById: context.sheetById,
    });
    if (working.combatEnded) {
      const fallback =
        working.plansByPlacementId[working.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
      return {
        session: working,
        label: benchCombatEndLabel(working.endReason ?? "stalemate"),
        actorPlacementId: working.deciderPlacementId,
        actorPosition: fallback,
        done: true,
      };
    }
    newCombatRound = working.combatRound;
  }

  const turn = working.turnSequence[working.turnIndex];
  if (!turn) {
    const fallback =
      working.plansByPlacementId[working.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
    return {
      session: working,
      label: `第 ${working.combatRound} 战斗轮：无行动步进`,
      actorPlacementId: working.deciderPlacementId,
      actorPosition: fallback,
      done: false,
      newCombatRound,
    };
  }

  session = working;

  let bundle = session.plansByPlacementId[turn.placementId];
  if (!bundle) {
    const next: CombatBenchSession = { ...session, turnIndex: session.turnIndex + 1 };
    return {
      session: next,
      label: `${turn.label} · 无计划`,
      actorPlacementId: turn.placementId,
      actorPosition: { x: 0, y: 0 },
      done: false,
      newCombatRound,
    };
  }

  bundle = replanPlacementTurn({
    map: context.map,
    placements: context.placements,
    sheetById: context.sheetById,
    placementId: turn.placementId,
    prior: bundle,
    randomSeed: session.randomSeed,
  });

  const slotActions = bundle.plan.actions.filter((a) => a.round === turn.slot);
  let snapshot = bundle.snapshot;
  const parts = slotActions.map((a) => describePlanStepText(bundle.payload, a));
  for (const action of slotActions) {
    snapshot = applyPlanStepToSnapshot(snapshot, bundle.payload, action);
  }
  snapshot = spendInitiativeForSlot(snapshot, turn.slot);

  const plansByPlacementId = {
    ...session.plansByPlacementId,
    [turn.placementId]: { ...bundle, snapshot },
  };

  const label =
    parts.length > 0
      ? `${turn.label} · ${parts.join(" + ")}`
      : `${turn.label} · 主动段 ${turn.slot + 1}（空）`;

  const next: CombatBenchSession = {
    ...session,
    plansByPlacementId,
    turnIndex: session.turnIndex + 1,
  };

  const stepLabel =
    newCombatRound !== undefined
      ? `进入第 ${newCombatRound} 战斗轮 · ${label}`
      : label;

  return {
    session: next,
    label: stepLabel,
    actorPlacementId: turn.placementId,
    actorPosition: snapshot.position,
    done: false,
    newCombatRound,
  };
}

export function parseBenchMapViewBox(svgMarkup: string): SvgViewBox | null {
  return parseSvgViewBox(svgMarkup);
}
