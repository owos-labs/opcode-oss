/** Opcode 1.7 range band base difficulty (shotgun uses same bands in MVP). */
export function rangeBandDifficulty(
  distanceM: number,
  weaponRangeM: number,
): number {
  const r = Math.max(weaponRangeM, 1e-3);
  const d = Math.max(0, distanceM);
  if (d <= 2.5) return 10;
  if (d <= r * 0.5) return 15;
  if (d <= r) return 20;
  if (d <= r * 2) return 25;
  return 30;
}

export function rangeUtilityPenalty(difficulty: number): number {
  return difficulty * 0.05;
}
