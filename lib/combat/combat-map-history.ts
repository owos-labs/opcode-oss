export const COMBAT_MAP_HISTORY_MAX_STEPS = 20;

export type CombatMapHistory = {
  past: string[];
  future: string[];
};

export function createCombatMapHistory(initialSvg: string): CombatMapHistory {
  return { past: [initialSvg], future: [] };
}

export function pushCombatMapHistory(
  history: CombatMapHistory,
  nextSvg: string,
  maxSteps = COMBAT_MAP_HISTORY_MAX_STEPS,
): CombatMapHistory {
  const current = history.past[history.past.length - 1];
  if (current === nextSvg) return { past: history.past, future: [] };
  let past = [...history.past, nextSvg];
  if (past.length > maxSteps + 1) past = past.slice(past.length - (maxSteps + 1));
  return { past, future: [] };
}

export function undoCombatMapHistory(
  history: CombatMapHistory,
): { history: CombatMapHistory; svg: string | null } {
  if (history.past.length <= 1) return { history, svg: null };
  const current = history.past[history.past.length - 1]!;
  const past = history.past.slice(0, -1);
  const svg = past[past.length - 1]!;
  return { history: { past, future: [current, ...history.future] }, svg };
}

export function redoCombatMapHistory(
  history: CombatMapHistory,
): { history: CombatMapHistory; svg: string | null } {
  if (history.future.length === 0) return { history, svg: null };
  const [next, ...future] = history.future;
  const past = [...history.past, next!];
  return { history: { past, future }, svg: next! };
}
