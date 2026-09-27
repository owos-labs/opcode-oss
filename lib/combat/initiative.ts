/** Cost of the n-th standard action this round (1-based index → 3, 6, 9, …). */
export function initiativeCostOfStandardAction(zeroBasedIndex: number): number {
  if (zeroBasedIndex < 0) throw new RangeError("action index");
  return 3 * (zeroBasedIndex + 1);
}

export function totalInitiativeForStandardActionCount(count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += initiativeCostOfStandardAction(i);
  return total;
}

/** Max standard actions affordable with given initiative pool (Opcode 1.7). */
export function maxStandardActionsInRound(initiativeTotal: number): number {
  if (initiativeTotal < initiativeCostOfStandardAction(0)) return 0;
  let count = 1;
  while (totalInitiativeForStandardActionCount(count + 1) <= initiativeTotal) count++;
  return count;
}

/** Unified malus applied to all standard actions when taking 2+ in a round. */
export function unifiedStandardActionMalus(standardActionCount: number): number {
  if (standardActionCount <= 1) return 0;
  return -3 * (standardActionCount - 1);
}
