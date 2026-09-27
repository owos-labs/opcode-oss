import { actionFeasibilityIndex, isActionLegal } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { buildPlanningPayload, type PlanningPayload } from "./build-planning-payload.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import { sustainedFireRecheckToken, type CombatSnapshot } from "./snapshot.ts";

export type RecheckContext = {
  plan: RoundPlan;
  /** Snapshot used to build the plan. */
  planSnapshotVersion: number;
  planBarrierVersion: number;
  planSustainedFireToken: number;
  payload: PlanningPayload;
};

export type RecheckAgainstSnapshot = {
  context: RecheckContext;
  current: CombatSnapshot;
  map: CompiledCombatMap;
};

export type RecheckResult = {
  ok: boolean;
  reason?: string;
};

export function createRecheckContext(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  plan: RoundPlan,
  payload: PlanningPayload,
): RecheckContext {
  return {
    plan,
    planSnapshotVersion: plan.snapshotVersion,
    planBarrierVersion: payload.barrierVersion,
    planSustainedFireToken: payload.sustainedFireToken,
    payload,
  };
}

/** Version / sustained-fire token mismatch → reject without rebuilding. */
export function recheckPlanVersions(input: RecheckAgainstSnapshot): RecheckResult {
  const { context, current } = input;
  if (current.snapshotVersion !== context.planSnapshotVersion) {
    return { ok: false, reason: "snapshot_version" };
  }
  if (current.barrierVersion !== context.planBarrierVersion) {
    return { ok: false, reason: "barrier_version" };
  }
  if (sustainedFireRecheckToken(current.sustainedFire) !== context.planSustainedFireToken) {
    return { ok: false, reason: "sustained_fire_token" };
  }
  return { ok: true };
}

/** Rebuild legal tensor and verify each planned intent cell is still legal. */
export function recheckPlanActions(input: RecheckAgainstSnapshot): RecheckResult {
  const version = recheckPlanVersions(input);
  if (!version.ok) return version;

  const fresh = buildPlanningPayload(input.current, input.map);
  const { shape } = fresh.feasibility;

  for (const act of input.context.plan.actions) {
    if (!isActionLegal(fresh.feasibility, act.round, act.kind, act.tile, act.target)) {
      return { ok: false, reason: "intent_no_longer_legal" };
    }
    const i = actionFeasibilityIndex(shape, act.round, act.kind, act.tile, act.target);
    if (fresh.utility[i]! <= -1e8) {
      return { ok: false, reason: "intent_utility_collapsed" };
    }
  }
  return { ok: true };
}
