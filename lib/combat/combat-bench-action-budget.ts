import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { walkPathPoints } from "../combat-ai/walk-path.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import type { PlacementBenchPlan } from "./combat-bench.ts";
import { actionKindLabel } from "./combat-plan-intent.ts";
import {
  initiativeCostOfStandardAction,
  maxStandardActionsInRound,
  totalInitiativeForStandardActionCount,
} from "./initiative.ts";
import { maxRoundMovementMeters, remainingMoveBudgetMeters } from "./movement.ts";

export type PlanMoveLeg = {
  round: number;
  planIndex: number;
  from: Vec2;
  to: Vec2;
  meters: number;
  metersAfterLeg: number;
  movRemainingAfterLeg: number;
  path: Vec2[];
};

export type InitiativeRoundBudget = {
  round: number;
  slotCost: number;
  cumulativeInitiativeSpent: number;
  initiativeRemainingAfter: number;
  actionCount: number;
  kinds: string[];
};

export type CombatBenchActionBudgetView = {
  initiativeTotal: number;
  initiativeAtPlanStart: number;
  initiativePlannedSpend: number;
  initiativeAfterPlan: number;
  maxInitiativeSlots: number;
  rounds: InitiativeRoundBudget[];
  movRoundMax: number;
  movAtPlanStart: number;
  movPlannedSpend: number;
  movAfterPlan: number;
  moveLegs: PlanMoveLeg[];
};

const MOVE_KIND = actionKindIndex("move");

function orderedPlanActions(plan: RoundPlan): { action: ActionIntent; planIndex: number }[] {
  return plan.actions
    .map((action, planIndex) => ({ action, planIndex }))
    .sort((a, b) =>
      a.action.round !== b.action.round
        ? a.action.round - b.action.round
        : a.planIndex - b.planIndex,
    );
}

export function buildCombatBenchActionBudgetView(
  bundle: PlacementBenchPlan,
): CombatBenchActionBudgetView {
  const { snapshot, payload, plan } = bundle;
  const ordered = orderedPlanActions(plan);

  let metersMoved = snapshot.metersMovedThisRound;
  const movRoundMax = maxRoundMovementMeters(snapshot.mov);
  const moveLegs: PlanMoveLeg[] = [];
  let sim = snapshot;

  for (const { action, planIndex } of ordered) {
    if (action.kind !== MOVE_KIND) {
      sim = applyPlanStepToSnapshot(sim, payload, action);
      continue;
    }
    const before = sim.position;
    const metersBefore = sim.metersMovedThisRound;
    sim = applyPlanStepToSnapshot(sim, payload, action);
    const moved =
      sim.position.x !== before.x ||
      sim.position.y !== before.y ||
      sim.metersMovedThisRound > metersBefore;
    if (!moved) continue;
    const meters = sim.metersMovedThisRound - metersBefore;
    const walls = payload.walls ?? [];
    moveLegs.push({
      round: action.round,
      planIndex,
      from: { ...before },
      to: { ...sim.position },
      meters,
      metersAfterLeg: sim.metersMovedThisRound,
      movRemainingAfterLeg: remainingMoveBudgetMeters(snapshot.mov, sim.metersMovedThisRound),
      path: walkPathPoints(before, sim.position, walls, meters + 8),
    });
  }
  metersMoved = sim.metersMovedThisRound;

  const roundSet = new Set(plan.actions.map((a) => a.round));
  const roundIndexes = [...roundSet].sort((a, b) => a - b);
  let cumulativeInit = 0;
  const rounds: InitiativeRoundBudget[] = roundIndexes.map((round) => {
    const slotCost = initiativeCostOfStandardAction(round);
    cumulativeInit += slotCost;
    const inRound = plan.actions.filter((a) => a.round === round);
    return {
      round,
      slotCost,
      cumulativeInitiativeSpent: cumulativeInit,
      initiativeRemainingAfter: Math.max(0, snapshot.initiativeRemaining - cumulativeInit),
      actionCount: inRound.length,
      kinds: inRound.map((a) => actionKindLabel(a.kind)),
    };
  });

  const initiativePlannedSpend = cumulativeInit;
  const maxSlots = maxStandardActionsInRound(snapshot.initiativeRemaining);

  return {
    initiativeTotal: snapshot.initiativeTotal,
    initiativeAtPlanStart: snapshot.initiativeRemaining,
    initiativePlannedSpend,
    initiativeAfterPlan: Math.max(0, snapshot.initiativeRemaining - initiativePlannedSpend),
    maxInitiativeSlots: maxSlots,
    rounds,
    movRoundMax,
    movAtPlanStart: remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound),
    movPlannedSpend: metersMoved - snapshot.metersMovedThisRound,
    movAfterPlan: remainingMoveBudgetMeters(snapshot.mov, metersMoved),
    moveLegs,
  };
}

/** Initiative pool consumed if the unit uses the first `slotCount` standard-action slots. */
export function initiativeSpendForSlotCount(slotCount: number): number {
  return totalInitiativeForStandardActionCount(Math.max(0, slotCount));
}
