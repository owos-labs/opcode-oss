import {
  actionFeasibilityIndex,
  actionKindIndex,
  ACTION_KINDS,
  type ActionCell,
  type ActionFeasibilityTensor,
  iterateLegalActions,
} from "./action-feasibility.ts";
import { maxStandardActionsThisRound } from "./combat-policy.ts";
import type { NpcDifficultyProfile } from "./difficulty.ts";
import { getNpcDifficultyProfile, type NpcDifficultyId } from "./difficulty.ts";

export type ActionTiming = "immediate" | "delayed" | "conditional";

export type ScoredActionOption = ActionCell & {
  utility: number;
  utilityUpperBound: number;
  kindId: (typeof ACTION_KINDS)[number];
  timing: ActionTiming;
};

export type PlanningBundle = {
  profile: NpcDifficultyProfile;
  feasibility: ActionFeasibilityTensor;
  /** Row-major utility per tensor cell (same length as legal). */
  utility: Float32Array;
  randomSeed: number;
  snapshotVersion: number;
  allowNpcSurrender: boolean;
  surrenderThreshold: number;
  deadlineMs: number;
  maxStandardActions: number;
  locatedPathConditional: boolean;
};

/** Deterministic PRNG for one decide() run (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildScoredOptions(bundle: PlanningBundle): ScoredActionOption[] {
  const { feasibility, utility } = bundle;
  const options: ScoredActionOption[] = [];

  for (const cell of iterateLegalActions(feasibility)) {
    const i = actionFeasibilityIndex(
      feasibility.shape,
      cell.round,
      cell.kind,
      cell.tile,
      cell.target,
    );
    const base = utility[i] ?? 0;
    const kindId = ACTION_KINDS[cell.kind];
    if (kindId === undefined) continue;
    const pathConditional =
      bundle.locatedPathConditional &&
      cell.tile === 0 &&
      (kindId === "standard_fire" || kindId === "suppressive_fire" || kindId === "throw");

    options.push({
      ...cell,
      kindId,
      utility: base,
      utilityUpperBound: base,
      timing: pathConditional ? "conditional" : "immediate",
    });
  }

  return options;
}

export function applySurrenderGate(
  bundle: PlanningBundle,
  options: readonly ScoredActionOption[],
): ScoredActionOption[] {
  if (!bundle.allowNpcSurrender) {
    const surrenderKind = actionKindIndex("surrender");
    return options.filter(o => o.kind !== surrenderKind);
  }

  const surrenderKind = actionKindIndex("surrender");
  let bestNonSurrender = -Infinity;
  for (const opt of options) {
    if (opt.kind === surrenderKind) continue;
    if (opt.utility > bestNonSurrender) bestNonSurrender = opt.utility;
  }

  return options.filter(opt => {
    if (opt.kind !== surrenderKind) return true;
    return bestNonSurrender <= bundle.surrenderThreshold;
  });
}

export function createPlanningBundle(input: {
  profileId: NpcDifficultyId;
  feasibility: ActionFeasibilityTensor;
  utility: Float32Array;
  randomSeed: number;
  snapshotVersion: number;
  allowNpcSurrender?: boolean;
  surrenderThreshold?: number;
  deadlineMs?: number;
  maxStandardActions?: number;
  locatedPathConditional?: boolean;
}): PlanningBundle {
  return {
    profile: getNpcDifficultyProfile(input.profileId),
    feasibility: input.feasibility,
    utility: input.utility,
    randomSeed: input.randomSeed,
    snapshotVersion: input.snapshotVersion,
    allowNpcSurrender: input.allowNpcSurrender ?? false,
    surrenderThreshold: input.surrenderThreshold ?? -Infinity,
    deadlineMs: input.deadlineMs ?? 4800,
    maxStandardActions:
      input.maxStandardActions ??
      maxStandardActionsThisRound({
        difficulty: input.profileId,
        hitEvPositive: true,
        extraAmbushStandard: false,
        initiativeBound: Number.POSITIVE_INFINITY,
      }),
    locatedPathConditional: input.locatedPathConditional ?? false,
  };
}

export function prepareOptionsForSearch(bundle: PlanningBundle): ScoredActionOption[] {
  return applySurrenderGate(bundle, buildScoredOptions(bundle));
}
