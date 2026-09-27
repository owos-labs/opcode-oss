import { rangeBandDifficulty, rangeUtilityPenalty } from "../range-difficulty.ts";
import type { CombatSnapshot } from "../snapshot.ts";
import type { Vec2 } from "../../combat-ai/visibility.ts";

export function throwActionLegal(snapshot: CombatSnapshot): boolean {
  return snapshot.throwable !== undefined && snapshot.ammo.roundsInMagazine >= 0;
}

export function throwActionUtility(
  snapshot: CombatSnapshot,
  from: Vec2,
  targetPosition: Vec2,
): number {
  const t = snapshot.throwable;
  if (!t) return -Infinity;
  const dist = Math.hypot(targetPosition.x - from.x, targetPosition.y - from.y);
  const diff = rangeBandDifficulty(dist, t.rangeM);
  return t.expectedDamageDice * 2 - rangeUtilityPenalty(diff) * 10;
}
