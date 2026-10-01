import { actionKindIndex, ACTION_KINDS, isStandardActionKindId } from "./action-feasibility.ts";
import type { NpcDifficultyProfile } from "./difficulty.ts";
import { maxStandardActionsThisRound } from "./combat-policy.ts";
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

/** Fire/suppress may still be worth doing at U=0; reload/aim need strictly positive utility. */
function standardActionUsable(action: ScoredActionOption): boolean {
  if (!Number.isFinite(action.utility) || action.utility < 0) return false;
  if (action.kindId === "standard_fire" || action.kindId === "suppressive_fire") return action.utility >= 0;
  return action.utility > 0;
}

export function isStandardActionKindIndex(kind: number): boolean {
  const id = ACTION_KINDS[kind];
  return id !== undefined && isStandardActionKindId(id);
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
  const round0 = options.filter(o => o.round === 0 && Number.isFinite(o.utility));
  const moveKind = MOVE_KIND();
  let bestMove: ScoredActionOption | null = null;
  let bestStandard: ScoredActionOption | null = null;

  for (const opt of round0) {
    if (opt.kind === moveKind) {
      if (!bestMove || opt.utility > bestMove.utility) bestMove = opt;
    } else if (opt.tile === 0 && isStandardActionKindIndex(opt.kind) && standardActionUsable(opt)) {
      if (!bestStandard || opt.utility > bestStandard.utility) bestStandard = opt;
    }
  }

  if (!bestMove && !bestStandard) return [];
  if (!bestMove) return [toIntent(bestStandard!)];
  if (!bestStandard) return [toIntent(bestMove)];
  if (bestMove.utility > bestStandard!.utility) return [toIntent(bestMove)];
  if (bestStandard && bestStandard.utility >= bestMove!.utility) return [toIntent(bestStandard)];
  return [toIntent(bestMove!)];
}

/** Score complete alternatives at one landing, including the option to stay. */
export function selectDualMoveAndStandard(options: readonly ScoredActionOption[]): ActionIntent[] {
  return greedyCappedStandards(options.filter(o => o.round === 0), 1);
}

export function greedyCappedStandards(options: readonly ScoredActionOption[], maxStandards: number): ActionIntent[] {
  const legal = options.filter(o => Number.isFinite(o.utility));
  const moves = legal.filter(o => o.round === 0 && o.kind === MOVE_KIND());
  const standards = legal.filter(o => isStandardActionKindIndex(o.kind))
    .sort((a, b) => a.round - b.round || b.utility - a.utility);
  let best: ScoredActionOption[] = [], bestScore = -Infinity;
  const holdAllowed = moves.length === 0 || moves.some(m => m.tile === 0);
  for (const move of [...moves, ...(holdAllowed ? [undefined] : [])]) {
    const picked: ScoredActionOption[] = move ? [move] : [];
    const coverAction = legal.find(o => o.round === 0 && o.tile === (move?.tile ?? 0) && (o.kindId === "enter_cover" || o.kindId === "leave_cover"));
    if (coverAction) picked.push(coverAction);
    const rounds = new Set<number>();
    for (const action of standards) {
      if (rounds.size >= maxStandards || coverAction?.kindId === "enter_cover") break;
      if (action.tile !== (move?.tile ?? 0) || rounds.has(action.round) || !standardActionUsable(action)) continue;
      if (action.kindId === "suppressive_fire" || action.timing !== "immediate") continue;
      picked.push(action);
      rounds.add(action.round);
    }
    const score = picked.reduce((sum, o) => sum + o.utility, 0);
    if (score > bestScore) { best = picked; bestScore = score; }
  }
  if (maxStandards > 0) {
    for (const action of standards) {
      if (action.round !== 0 || action.tile !== 0) continue;
      if (action.kindId !== "suppressive_fire" && action.timing === "immediate") continue;
      if (standardActionUsable(action) && action.utility >= bestScore) { best = [action]; bestScore = action.utility; }
    }
  }
  return best.map(toIntent);
}

/** Greedy sequence: lower initiative rounds first, then utility. One-shot, no deepening. */
export function greedySequence(
  options: readonly ScoredActionOption[],
  depth: number,
): ActionIntent[] {
  return greedyCappedStandards(options, depth).slice(0, depth);
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

export function searchRoundPlan(
  profile: NpcDifficultyProfile,
  options: readonly ScoredActionOption[],
  _startedAtMs: number,
  _deadlineMs: number,
  maxStandardActions?: number,
): SearchResult {
  if (maxStandardActions === 0) options = options.filter(o => !isStandardActionKindIndex(o.kind));
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

  const cap =
    maxStandardActions ??
    maxStandardActionsThisRound({
      difficulty: profile.id,
      hitEvPositive: true,
      extraAmbushStandard: false,
      initiativeBound: Number.POSITIVE_INFINITY,
    });
  const actions = greedyCappedStandards(options, cap);
  return {
    actions,
    completedDepth: actions.length,
    totalUtility: sequenceUtility(actions, options),
    timedOut: false,
  };
}
