/** Walk portion of a move action (meters). */
export function maxWalkMeters(mov: number): number {
  return Math.max(0, mov) * 0.5;
}

export function maxRoundMovementMeters(mov: number): number {
  return Math.max(0, mov) * 1.5;
}

export function remainingMoveBudgetMeters(
  mov: number,
  metersMovedThisRound: number,
): number {
  return Math.max(0, maxRoundMovementMeters(mov) - Math.max(0, metersMovedThisRound));
}
