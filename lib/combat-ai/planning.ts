import {
  actionFeasibilityIndex,
  actionKindIndex,
  ACTION_KINDS,
  type ActionCell,
  type ActionFeasibilityTensor,
  iterateLegalActions,
} from "./action-feasibility.ts";
import type { NpcDifficultyProfile } from "./difficulty.ts";
import {
  delayedConditionalGatePasses,
  getNpcDifficultyProfile,
  lethalityFocusActive,
  suppressiveFireGatePasses,
  type NpcDifficultyId,
} from "./difficulty.ts";

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
};

export type BehaviorGateDraws = {
  lethality: number;
  suppressive: number;
  timing: number;
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

export function drawBehaviorGates(seed: number): BehaviorGateDraws {
  const next = mulberry32(seed);
  return { lethality: next(), suppressive: next(), timing: next() };
}

function isStandardActionKind(kind: number): boolean {
  const id = ACTION_KINDS[kind];
  return (
    id === "standard_fire" ||
    id === "suppressive_fire" ||
    id === "standard_reload" ||
    id === "standard_aim" ||
    id === "insert"
  );
}

export function buildScoredOptions(
  bundle: PlanningBundle,
  draws: BehaviorGateDraws,
): ScoredActionOption[] {
  const { feasibility, utility, profile } = bundle;
  const lethality = lethalityFocusActive(profile, draws.lethality);
  const lethalityWeight = lethality ? 1.35 : 1;
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

    let u = base;
    if (kindId === "standard_fire" || kindId === "suppressive_fire") {
      u *= lethalityWeight;
    }

    options.push({
      ...cell,
      kindId,
      utility: u,
      utilityUpperBound: u,
      timing: "immediate",
    });
  }

  return options;
}

export function applySuppressionGate(
  profile: NpcDifficultyProfile,
  options: readonly ScoredActionOption[],
  random01: number,
): ScoredActionOption[] {
  const suppressIdx = actionKindIndex("suppressive_fire");
  let bestSuppress: ScoredActionOption | null = null;
  let bestOther: ScoredActionOption | null = null;

  for (const opt of options) {
    if (opt.kind === suppressIdx) {
      if (!bestSuppress || opt.utility > bestSuppress.utility) bestSuppress = opt;
    } else if (!bestOther || opt.utility > bestOther.utility) {
      bestOther = opt;
    }
  }

  if (!bestSuppress) return [...options];
  const suppressIsTop =
    !bestOther || bestSuppress.utility >= bestOther.utility;
  if (suppressIsTop && !suppressiveFireGatePasses(profile, random01)) {
    return options.filter(o => o.kind !== suppressIdx);
  }
  return [...options];
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

/** Attach delayed/conditional timing when optimal; gate once per decide(). */
export function applyTimingGate(
  profile: NpcDifficultyProfile,
  options: ScoredActionOption[],
  random01: number,
): ScoredActionOption[] {
  if (!delayedConditionalGatePasses(profile, random01)) {
    return options.map(o => ({ ...o, timing: "immediate" as const }));
  }

  let bestImmediate: ScoredActionOption | null = null;
  for (const opt of options) {
    if (opt.timing !== "immediate") continue;
    if (!bestImmediate || opt.utility > bestImmediate.utility) bestImmediate = opt;
  }
  if (!bestImmediate) return options;

  const delayedBoost = 0.08;
  return options.map(opt => {
    if (opt !== bestImmediate) return opt;
    if (opt.utility + delayedBoost <= bestImmediate!.utility) return opt;
    return {
      ...opt,
      timing: "delayed" as const,
      utility: opt.utility + delayedBoost,
      utilityUpperBound: opt.utility + delayedBoost,
    };
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
  };
}

export function prepareOptionsForSearch(bundle: PlanningBundle): ScoredActionOption[] {
  const draws = drawBehaviorGates(bundle.randomSeed);
  let options = buildScoredOptions(bundle, draws);
  options = applySurrenderGate(bundle, options);
  options = applySuppressionGate(bundle.profile, options, draws.suppressive);
  options = applyTimingGate(bundle.profile, options, draws.timing);
  return options;
}
