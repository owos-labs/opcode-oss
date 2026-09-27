import type { NpcDifficultyProfile } from "./difficulty.ts";

/** Per-body-part armor rating from character sheet `armor.protection.normal`. */
export type TargetArmorByPart = Record<string, number>;

export type PenetrationExpectation = {
  /** Planning assumption: round defeats armor at this hit location. */
  expectedPenetrates: boolean;
  /** ammo penetration minus armor rating (negative = likely stopped). */
  margin: number;
};

export function armorRatingForPart(
  armorByPart: TargetArmorByPart,
  hitPart: string,
): number {
  const value = armorByPart[hitPart];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Strongest protected part on the target (conservative when aim part unknown). */
export function maxArmorRating(armorByPart: TargetArmorByPart): number {
  let max = 0;
  for (const value of Object.values(armorByPart)) {
    if (typeof value === "number" && Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

export function penetrationExpectation(
  ammoPenetration: number,
  armorRating: number,
): PenetrationExpectation {
  const pen = Number.isFinite(ammoPenetration) ? ammoPenetration : 0;
  const armor = Number.isFinite(armorRating) ? armorRating : 0;
  const margin = pen - armor;
  return { expectedPenetrates: margin >= 0, margin };
}

export type ArmorPenetrationPlanInput = {
  profile: NpcDifficultyProfile;
  ammoPenetration: number;
  targetArmor: TargetArmorByPart;
  /** When omitted, uses maxArmorRating (worst case for the shooter). */
  hitPart?: string;
};

/**
 * Novice+: AI may skip or deprioritize shots that are not expected to beat armor.
 * Returns null when the tier ignores armor (newstupid).
 */
export function expectedArmorPenetration(
  input: ArmorPenetrationPlanInput,
): PenetrationExpectation | null {
  if (!input.profile.considersArmorPenetration) return null;
  const rating =
    input.hitPart !== undefined
      ? armorRatingForPart(input.targetArmor, input.hitPart)
      : maxArmorRating(input.targetArmor);
  return penetrationExpectation(input.ammoPenetration, rating);
}

/** Utility scale for eval: 1 if expected through armor, 0 if not. */
export function armorPenetrationDamageFactor(expectation: PenetrationExpectation | null): number {
  if (expectation === null) return 1;
  return expectation.expectedPenetrates ? 1 : 0;
}
