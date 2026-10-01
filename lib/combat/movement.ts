/** Walk portion of a move action (meters). */
export function maxWalkMeters(mov: number): number {
  return Math.max(0, mov) * 0.5;
}

export function maxRoundMovementMeters(mov: number): number {
  return Math.max(0, mov);
}

export function remainingMoveBudgetMeters(
  mov: number,
  metersMovedThisRound: number,
): number {
  return Math.max(0, maxRoundMovementMeters(mov) - Math.max(0, metersMovedThisRound));
}

export function stepToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
  meters: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1e-9 || d <= meters) return { x: to.x, y: to.y };
  const k = meters / d;
  return { x: from.x + dx * k, y: from.y + dy * k };
}
