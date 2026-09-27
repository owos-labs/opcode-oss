import {
  createPlanningBundle,
  prepareOptionsForSearch,
} from "../combat-ai/planning.ts";
import type { DecideInput, RoundPlan } from "../combat-ai/decide.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import {
  searchRoundPlanWithSimulation,
  type PlanSimulationContext,
} from "./stateful-plan-search.ts";
import type { CombatSnapshot } from "./snapshot.ts";

export type { PlanSimulationContext };

/** Bench / run-check: search respects mov & ammo as the plan is built. */
export function decideRoundPlanWithSimulation(
  input: DecideInput & {
    snapshot: CombatSnapshot;
    payload: PlanningPayload;
  },
): RoundPlan {
  const bundle = createPlanningBundle({
    profileId: input.profileId,
    feasibility: input.feasibility,
    utility: input.utility,
    randomSeed: input.randomSeed,
    snapshotVersion: input.snapshotVersion,
    allowNpcSurrender: input.allowNpcSurrender,
    surrenderThreshold: input.surrenderThreshold,
    deadlineMs: input.deadlineMs,
  });
  const options = prepareOptionsForSearch(bundle);
  const startedAtMs = input.startedAtMs ?? Date.now();
  const context: PlanSimulationContext = {
    snapshot: input.snapshot,
    payload: input.payload,
  };
  const result = searchRoundPlanWithSimulation(
    bundle.profile,
    options,
    context,
    startedAtMs,
    bundle.deadlineMs,
  );
  return {
    snapshotVersion: bundle.snapshotVersion,
    randomSeed: bundle.randomSeed,
    actions: result.actions,
    completedDepth: result.completedDepth,
    totalUtility: result.totalUtility,
    timedOut: result.timedOut,
  };
}
