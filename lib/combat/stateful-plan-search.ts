import type { NpcDifficultyProfile } from "../combat-ai/difficulty.ts";
import type { ScoredActionOption } from "../combat-ai/planning.ts";
import {
  searchRoundPlan,
  type ActionIntent,
  type SearchResult,
} from "../combat-ai/search.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { planActionLegalAtSnapshot } from "./plan-action-legality.ts";
import type { CombatSnapshot } from "./snapshot.ts";

export type PlanSimulationContext = {
  snapshot: CombatSnapshot;
  payload: PlanningPayload;
};

function sameActionCell(a: ActionIntent, b: ScoredActionOption): boolean {
  return (
    a.round === b.round &&
    a.kind === b.kind &&
    a.tile === b.tile &&
    a.target === b.target
  );
}

function toIntent(opt: ScoredActionOption): ActionIntent {
  return {
    round: opt.round,
    kind: opt.kind,
    tile: opt.tile,
    target: opt.target,
    timing: opt.timing,
  };
}

function sequenceUtility(
  actions: readonly ActionIntent[],
  options: readonly ScoredActionOption[],
): number {
  let total = 0;
  for (const act of actions) {
    const match = options.find(
      (o) =>
        o.round === act.round &&
        o.kind === act.kind &&
        o.tile === act.tile &&
        o.target === act.target,
    );
    if (match) total += match.utility;
  }
  return total;
}

/** Extend plan by greedy utility while applying each pick to a running snapshot. */
export function greedySequenceStateful(
  options: readonly ScoredActionOption[],
  depth: number,
  context: PlanSimulationContext,
): ActionIntent[] {
  const sorted = [...options].sort((a, b) =>
    a.round !== b.round ? a.round - b.round : b.utility - a.utility,
  );
  const picked: ActionIntent[] = [];
  let sim = context.snapshot;
  let minRound = -1;

  for (const opt of sorted) {
    if (picked.length >= depth) break;
    if (opt.round < minRound) continue;
    if (picked.some((p) => sameActionCell(p, opt))) continue;
    if (!planActionLegalAtSnapshot(sim, context.payload, opt)) continue;
    const intent = toIntent(opt);
    sim = applyPlanStepToSnapshot(sim, context.payload, intent);
    picked.push(intent);
    minRound = opt.round;
  }
  return picked;
}

function maxSearchDepth(profile: NpcDifficultyProfile): number {
  if (profile.singleActionMoveXorStandard) return 1;
  if (!profile.considersActionEconomy) return 2;
  if (profile.maxInitiativeRounds === 2) return 4;
  if (profile.maxInitiativeRounds === "all") return 6;
  return 2;
}

export function searchRoundPlanWithSimulation(
  profile: NpcDifficultyProfile,
  options: readonly ScoredActionOption[],
  context: PlanSimulationContext,
  startedAtMs: number,
  deadlineMs: number,
): SearchResult {
  if (profile.singleActionMoveXorStandard || !profile.considersActionEconomy) {
    return searchRoundPlan(profile, options, startedAtMs, deadlineMs);
  }

  const maxDepth = maxSearchDepth(profile);
  let bestActions: ActionIntent[] = [];
  let bestScore = -Infinity;
  let completedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startedAtMs > deadlineMs) {
      return {
        actions: bestActions,
        completedDepth,
        totalUtility: bestScore,
        timedOut: true,
      };
    }
    const seq = greedySequenceStateful(options, depth, context);
    const score = sequenceUtility(seq, options);
    completedDepth = depth;
    if (score > bestScore) {
      bestScore = score;
      bestActions = seq;
    }
  }

  return {
    actions: bestActions,
    completedDepth,
    totalUtility: bestScore,
    timedOut: false,
  };
}
