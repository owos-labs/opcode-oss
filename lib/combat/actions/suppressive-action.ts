import type { CombatSnapshot } from "../snapshot.ts";

/** Simplified suppressive legality (1.7): semi-auto+, ammo, not already in incompatible state. */
export function suppressiveFireLegal(snapshot: CombatSnapshot): boolean {
  if (!snapshot.weapon.semiAutoOrBetter) return false;
  if (snapshot.ammo.roundsInMagazine <= 0) return false;
  const rofQuota = Math.floor(snapshot.weapon.rateOfFire / 20);
  return rofQuota >= 1;
}

export function suppressiveFireUtility(snapshot: CombatSnapshot): number {
  if (!suppressiveFireLegal(snapshot)) return -Infinity;
  const rofQuota = Math.floor(snapshot.weapon.rateOfFire / 20);
  return 4 + rofQuota * 0.2 + (snapshot.suppressionActive ? 1 : 0);
}
