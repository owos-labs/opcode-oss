import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { decideRoundPlan } from "../combat-ai/decide.ts";
import { buildPlanningPayload, type PlanningPayload } from "./build-planning-payload.ts";
import { compileCombatMap, type CompiledCombatMap } from "./map-adapter/compile.ts";
import type { CombatMapDto } from "./map-adapter/types.ts";
import {
  createRecheckContext,
  recheckPlanActions,
  recheckPlanVersions,
  type RecheckResult,
} from "./recheck.ts";
import type { CombatSnapshot } from "./snapshot.ts";

export type CombatCheckInput = {
  snapshot: CombatSnapshot;
  map: CombatMapDto | CompiledCombatMap;
  randomSeed?: number;
  startedAtMs?: number;
};

export type CombatCheckReport = {
  mapId: string;
  payload: PlanningPayload;
  plan: RoundPlan;
  recheckOk: boolean;
  recheckReason?: string;
  conditionalIntents: number;
  legalCellCount: number;
};

function resolveMap(map: CombatMapDto | CompiledCombatMap): CompiledCombatMap {
  return "barriers" in map ? map : compileCombatMap(map);
}

export function runCombatCheck(input: CombatCheckInput): CombatCheckReport {
  const compiled = resolveMap(input.map);
  const payload = buildPlanningPayload(input.snapshot, compiled);
  let legalCellCount = 0;
  for (const x of payload.feasibility.legal) if (x === 1) legalCellCount++;

  const plan = decideRoundPlan({
    profileId: input.snapshot.encounter.profileId,
    feasibility: payload.feasibility,
    utility: payload.utility,
    randomSeed: input.randomSeed ?? 42,
    snapshotVersion: input.snapshot.snapshotVersion,
    allowNpcSurrender: input.snapshot.encounter.allowNpcSurrender,
    surrenderThreshold: input.snapshot.encounter.surrenderThreshold,
    startedAtMs: input.startedAtMs ?? Date.now(),
    maxStandardActions: payload.maxStandardActions,
    locatedPathConditional: payload.locatedPathConditional,
  });

  const context = createRecheckContext(input.snapshot, compiled, plan, payload);
  const recheck = recheckPlanActions({
    context,
    current: input.snapshot,
    map: compiled,
  });

  const fireKind = actionKindIndex("standard_fire");
  const conditionalIntents = plan.actions.filter(
    a => a.kind === fireKind && a.timing === "conditional",
  ).length;

  return {
    mapId: compiled.mapId,
    payload,
    plan,
    recheckOk: recheck.ok,
    recheckReason: recheck.reason,
    conditionalIntents,
    legalCellCount,
  };
}

export function runCombatCheckAfterBarrierBump(
  input: CombatCheckInput,
  bump: Partial<CombatSnapshot>,
): { before: CombatCheckReport; afterVersionRecheck: RecheckResult } {
  const before = runCombatCheck(input);
  const compiled = resolveMap(input.map);
  const context = createRecheckContext(
    input.snapshot,
    compiled,
    before.plan,
    before.payload,
  );
  const current: CombatSnapshot = { ...input.snapshot, ...bump };
  const afterVersionRecheck = recheckPlanVersions({
    context,
    current,
    map: compiled,
  });
  return { before, afterVersionRecheck };
}
