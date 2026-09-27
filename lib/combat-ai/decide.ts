import { createPlanningBundle, prepareOptionsForSearch, type PlanningBundle } from "./planning.ts";
import { searchRoundPlan, type ActionIntent, type SearchResult } from "./search.ts";
import type { ActionFeasibilityTensor } from "./action-feasibility.ts";
import type { NpcDifficultyId } from "./difficulty.ts";
import { NPC_AI_DEADLINE_MS } from "./difficulty.ts";

export type { ActionIntent, SearchResult };

export type DecideInput = {
  profileId: NpcDifficultyId;
  feasibility: ActionFeasibilityTensor;
  utility: Float32Array;
  randomSeed: number;
  snapshotVersion: number;
  allowNpcSurrender?: boolean;
  surrenderThreshold?: number;
  startedAtMs?: number;
  deadlineMs?: number;
};

export type RoundPlan = {
  snapshotVersion: number;
  randomSeed: number;
  actions: ActionIntent[];
  completedDepth: number;
  totalUtility: number;
  timedOut: boolean;
};

export function decideRoundPlan(input: DecideInput): RoundPlan {
  const bundle = createPlanningBundle({
    profileId: input.profileId,
    feasibility: input.feasibility,
    utility: input.utility,
    randomSeed: input.randomSeed,
    snapshotVersion: input.snapshotVersion,
    allowNpcSurrender: input.allowNpcSurrender,
    surrenderThreshold: input.surrenderThreshold,
    deadlineMs: input.deadlineMs ?? NPC_AI_DEADLINE_MS,
  });

  return decideFromBundle(bundle, input.startedAtMs ?? Date.now());
}

export function decideFromBundle(
  bundle: PlanningBundle,
  startedAtMs: number,
): RoundPlan {
  const options = prepareOptionsForSearch(bundle);
  const result = searchRoundPlan(
    bundle.profile,
    options,
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
