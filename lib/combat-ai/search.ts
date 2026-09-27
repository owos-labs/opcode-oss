import { actionKindIndex, ACTION_KINDS } from "./action-feasibility.ts";
import type { NpcDifficultyProfile } from "./difficulty.ts";
import type { ScoredActionOption } from "./planning.ts";

export type ActionIntent = {
  round: number;
  kind: number;
  tile: number;
  target: number;
  timing: "immediate" | "delayed" | "conditional";
};

export type SearchResult = {
  actions: ActionIntent[];
  completedDepth: number;
  totalUtility: number;
  timedOut: boolean;
};

const MOVE_KIND = () => actionKindIndex("move");

function isStandardActionKindIndex(kind: number): boolean {
  const id = ACTION_KINDS[kind];
  return (
    id === "standard_fire" ||
    id === "suppressive_fire" ||
    id === "standard_reload" ||
    id === "standard_aim" ||
    id === "insert"
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

/** Newstupid: best move XOR best standard on round 0. */
export function selectMoveXorStandard(options: readonly ScoredActionOption[]): ActionIntent[] {
  const round0 = options.filter(o => o.round === 0);
  const moveKind = MOVE_KIND();
  let bestMove: ScoredActionOption | null = null;
  let bestStandard: ScoredActionOption | null = null;

  for (const opt of round0) {
    if (opt.kind === moveKind) {
      if (!bestMove || opt.utility > bestMove.utility) bestMove = opt;
    } else if (isStandardActionKindIndex(opt.kind)) {
      if (!bestStandard || opt.utility > bestStandard.utility) bestStandard = opt;
    }
  }

  if (!bestMove && !bestStandard) return [];
  if (!bestMove) return [toIntent(bestStandard!)];
  if (!bestStandard) return [toIntent(bestMove)];
  return bestMove.utility >= bestStandard.utility
    ? [toIntent(bestMove)]
    : [toIntent(bestStandard)];
}

/** Novice: best move + best standard on round 0 when both exist. */
export function selectDualMoveAndStandard(
  options: readonly ScoredActionOption[],
): ActionIntent[] {
  const round0 = options.filter(o => o.round === 0);
  const moveKind = MOVE_KIND();
  let bestMove: ScoredActionOption | null = null;
  let bestStandard: ScoredActionOption | null = null;

  for (const opt of round0) {
    if (opt.kind === moveKind) {
      if (!bestMove || opt.utility > bestMove.utility) bestMove = opt;
    } else if (isStandardActionKindIndex(opt.kind)) {
      if (!bestStandard || opt.utility > bestStandard.utility) bestStandard = opt;
    }
  }

  const out: ActionIntent[] = [];
  if (bestMove) out.push(toIntent(bestMove));
  if (bestStandard) out.push(toIntent(bestStandard));
  return out;
}

function maxSearchDepth(profile: NpcDifficultyProfile): number {
  if (profile.singleActionMoveXorStandard) return 1;
  if (!profile.considersActionEconomy) return 2;
  if (profile.maxInitiativeRounds === 2) return 4;
  if (profile.maxInitiativeRounds === "all") return 6;
  return 2;
}

/** Greedy sequence: lower initiative rounds first, then utility (static tensor; no simulation). */
export function greedySequence(
  options: readonly ScoredActionOption[],
  depth: number,
): ActionIntent[] {
  const sorted = [...options].sort((a, b) =>
    a.round !== b.round ? a.round - b.round : b.utility - a.utility,
  );
  const picked: ActionIntent[] = [];
  let minRound = -1;

  for (const opt of sorted) {
    if (picked.length >= depth) break;
    if (opt.round < minRound) continue;
    if (
      picked.some(
        (p) =>
          p.round === opt.round &&
          p.kind === opt.kind &&
          p.tile === opt.tile &&
          p.target === opt.target,
      )
    ) {
      continue;
    }
    picked.push(toIntent(opt));
    minRound = opt.round;
  }
  return picked;
}

function sequenceUtility(
  actions: readonly ActionIntent[],
  options: readonly ScoredActionOption[],
): number {
  let total = 0;
  for (const act of actions) {
    const match = options.find(
      o =>
        o.round === act.round &&
        o.kind === act.kind &&
        o.tile === act.tile &&
        o.target === act.target,
    );
    if (match) total += match.utility;
  }
  return total;
}

/**
 * Iterative deepening over greedy sequences; keeps last complete depth before deadline.
 */
export function searchWithIterativeDeepening(
  profile: NpcDifficultyProfile,
  options: readonly ScoredActionOption[],
  startedAtMs: number,
  deadlineMs: number,
): SearchResult {
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
    const seq = greedySequence(options, depth);
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

export function searchRoundPlan(
  profile: NpcDifficultyProfile,
  options: readonly ScoredActionOption[],
  startedAtMs: number,
  deadlineMs: number,
): SearchResult {
  if (profile.singleActionMoveXorStandard) {
    const actions = selectMoveXorStandard(options);
    return {
      actions,
      completedDepth: actions.length > 0 ? 1 : 0,
      totalUtility: sequenceUtility(actions, options),
      timedOut: false,
    };
  }

  if (!profile.considersActionEconomy) {
    const actions = selectDualMoveAndStandard(options);
    return {
      actions,
      completedDepth: actions.length > 0 ? 1 : 0,
      totalUtility: sequenceUtility(actions, options),
      timedOut: false,
    };
  }

  return searchWithIterativeDeepening(profile, options, startedAtMs, deadlineMs);
}

/** Drop options whose upper bound cannot beat current best. */
export function pruneByUpperBound(
  options: ScoredActionOption[],
  bestUtility: number,
): ScoredActionOption[] {
  return options.filter(o => o.utilityUpperBound >= bestUtility);
}
