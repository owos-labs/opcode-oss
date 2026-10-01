import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { maxStandardActionsInRound, unifiedStandardActionMalus } from "./initiative.ts";

export function isStandardActionKind(kindIndex: number): boolean {
  const id = ACTION_KINDS[kindIndex];
  return id !== "move" && id !== "enter_cover" && id !== "leave_cover";
}

export function standardActionsDeclaredInPlan(plan: RoundPlan): number {
  return plan.actions.filter((a) => isStandardActionKind(a.kind)).length;
}

/** 轮初声明的标准动作数：计划内标准动作，且不超过当前主动性买得起的段数（1.7）。 */
export function declaredStandardActionsForRound(
  plan: RoundPlan,
  initiativeRemaining: number,
): number {
  const planned = standardActionsDeclaredInPlan(plan);
  if (planned <= 0) return 0;
  const affordable = maxStandardActionsInRound(initiativeRemaining);
  if (affordable <= 0) return planned;
  return Math.min(planned, affordable);
}

export function buildDeclaredStandardActionsByPlacement(input: {
  plansByPlacementId: Readonly<Record<string, { plan: RoundPlan; snapshot: { initiativeRemaining: number } }>>;
  placementIds: readonly string[];
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of input.placementIds) {
    const bundle = input.plansByPlacementId[id];
    if (!bundle) {
      out[id] = 0;
      continue;
    }
    out[id] = declaredStandardActionsForRound(
      bundle.plan,
      bundle.snapshot.initiativeRemaining,
    );
  }
  return out;
}

/** Prior standard_fire segments this round (0 = first shot). */
export function priorStandardFireCount(plan: RoundPlan, initiativeSlot: number): number {
  return plan.actions.filter(
    (a) => ACTION_KINDS[a.kind] === "standard_fire" && a.round < initiativeSlot,
  ).length;
}

/** Rounds already fired in earlier initiative slots (standard_fire only; suppress is a separate action). */
export function priorStandardFireRoundsThisRound(
  plan: RoundPlan,
  initiativeSlot: number,
  _weaponRateOfFire?: number,
): number {
  let rounds = 0;
  for (const action of plan.actions) {
    if (action.round >= initiativeSlot) break;
    if (ACTION_KINDS[action.kind] === "standard_fire") rounds += 1;
  }
  return rounds;
}

export function rangedAttackMalusParts(input: {
  declaredStandardActions: number;
  /** Rounds already fired this combat round before this action. */
  priorStandardFiresThisRound: number;
  /** Rounds consumed by this action (1 for standard_fire, ROF/20 for suppress). */
  roundsThisAction?: number;
}): { unified: number; consecutiveFire: number } {
  const prior = Math.max(0, input.priorStandardFiresThisRound);
  const rounds = Math.max(1, input.roundsThisAction ?? 1);
  return {
    unified: unifiedStandardActionMalus(input.declaredStandardActions),
    consecutiveFire: -3 * (prior + rounds - 1),
  };
}

/** 1.7 unified malus (−3/−6…) plus same-weapon consecutive fire (−3 per prior shot). */
export function rangedAttackActionMalus(input: {
  declaredStandardActions: number;
  priorStandardFiresThisRound: number;
}): number {
  const parts = rangedAttackMalusParts(input);
  return parts.unified + parts.consecutiveFire;
}
