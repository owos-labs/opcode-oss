import type { NpcDifficultyId } from "./difficulty.ts";

export type PolicyLocLevel = "none" | "approximate" | "exact" | "full";
export type FireModeId = "semi" | "auto" | "burst";
export type HitLocationPref = "head" | "chest" | "body" | "unarmored" | "random" | "none";
export type ConcealChoice = "conceal" | "nearest_cover" | "none";
export type AimPlan = {
  rounds: number;
  target: "key_kill" | "center_mass" | "body" | "none";
};

const POINT_BLANK_M = 2.5;

/** Default hit-EV: pass probability × damage-dice expectation (Q10). */
export function defaultHitExpectedValue(
  passProbability: number,
  expectedDamageDice: number,
): number {
  return passProbability * expectedDamageDice;
}

export function usesHeadcountForHitSign(difficulty: NpcDifficultyId): boolean {
  return difficulty === "newstupid" || difficulty === "novice" || difficulty === "trained";
}

/** Trained and below use headcount for the sign of hit-EV (Q10). */
export function hitExpectedPositive(input: {
  difficulty: NpcDifficultyId;
  passProbability: number;
  expectedDamageDice: number;
  hostileCount: number;
}): boolean {
  if (usesHeadcountForHitSign(input.difficulty)) return input.hostileCount > 0;
  return defaultHitExpectedValue(input.passProbability, input.expectedDamageDice) > 0;
}

/** Fuzzy is fireable when the weapon pens cover or the actor is using a grenade. */
export function canTreatFuzzyAsFireable(canPenCover: boolean, grenade: boolean): boolean {
  return canPenCover || grenade;
}

/**
 * Line of effect for planning. Exact is LoE (P0). Expert exact + pen/grenade is LoE (Q15).
 * Professional fuzzy is LoE only when canPenCover || grenade.
 */
export function countsAsLineOfEffect(
  difficulty: NpcDifficultyId,
  loc: PolicyLocLevel,
  opts: { canPenCover: boolean; grenade: boolean },
): boolean {
  if (loc === "full") return true;
  if (loc === "exact") {
    if (difficulty === "expert" && (opts.canPenCover || opts.grenade)) return true;
    return true;
  }
  if (loc === "approximate") {
    return difficulty === "professional" && canTreatFuzzyAsFireable(opts.canPenCover, opts.grenade);
  }
  return false;
}

/** Direct-fire legality. Fuzzy is illegal for newstupid / novice / trained; expert never fires at fuzzy. */
export function canDifficultyFireAtLoc(
  difficulty: NpcDifficultyId,
  loc: PolicyLocLevel,
  opts: { canPenCover: boolean; grenade: boolean },
): boolean {
  if (loc === "none") return false;
  if (loc === "full" || loc === "exact") return true;
  if (difficulty === "professional") return canTreatFuzzyAsFireable(opts.canPenCover, opts.grenade);
  return false;
}

/** Expert: 0.25 chance throw or suppress vs fuzzy; professional always; lower tiers never. */
export function isThrowOrSuppressLegalForFuzzy(
  difficulty: NpcDifficultyId,
  rng: () => number,
): boolean {
  if (difficulty === "professional") return true;
  if (difficulty === "expert") return rng() < 0.25;
  return false;
}

export function allowsThrowOrSuppress(difficulty: NpcDifficultyId): boolean {
  return difficulty !== "newstupid";
}

/** Suppress competes with direct fire only when the difficulty table allows it. */
export function suppressiveFirePlanningUtility(input: {
  difficulty: NpcDifficultyId;
  rawUtility: number;
  bestDirectFireUtility: number;
  allFuzzy: boolean;
  losing: boolean;
  rng: () => number;
}): number {
  const raw = input.rawUtility;
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  const direct = Math.max(0, input.bestDirectFireUtility);
  const canDirect = direct > 1e-6;

  if (input.allFuzzy) return Math.max(0, raw - direct);

  if (!canDirect) return raw;

  if (input.difficulty === "professional") {
    if (!input.losing) return 0;
    return Math.max(0, raw - direct);
  }
  if (input.difficulty === "expert") {
    if (!input.losing) return 0;
    if (input.rng() >= 0.5) return 0;
    return Math.max(0, raw - direct);
  }
  return 0;
}

export function maxStandardActionsThisRound(input: {
  difficulty: NpcDifficultyId;
  hitEvPositive: boolean;
  extraAmbushStandard?: boolean;
  initiativeBound: number;
}): number {
  const bound = Math.max(0, input.initiativeBound);
  const extra = input.extraAmbushStandard ? 1 : 0;
  let cap: number;
  if (input.difficulty === "professional") {
    cap = input.hitEvPositive ? bound : Math.min(1, bound);
  } else if (input.difficulty === "expert") {
    cap = input.hitEvPositive ? Math.min(3, bound) : Math.min(1, bound);
  } else if (input.difficulty === "trained") {
    cap = input.hitEvPositive ? Math.min(2, bound) : Math.min(1, bound);
  } else {
    cap = Math.min(1, bound);
  }
  return cap + extra;
}

/** No loc (not even approximate): professional may declare the extra-slot ambush (Q16). */
export function canDeclareUnlocatedAmbush(
  difficulty: NpcDifficultyId,
  highestHostileLoc: PolicyLocLevel,
): boolean {
  return difficulty === "professional" && highestHostileLoc === "none";
}

export type LocatedPathPolicy = {
  extraRound: false;
  timing: "conditional" | "immediate";
  allowThrowSuppress: boolean;
  declareAmbush: boolean;
};

/** Has-loc path: conditional intercept, never the extra first-round slot (Q16). */
export function locatedPathAmbushPolicy(difficulty: NpcDifficultyId): LocatedPathPolicy {
  if (difficulty === "professional") {
    return { extraRound: false, timing: "conditional", allowThrowSuppress: true, declareAmbush: true };
  }
  if (difficulty === "expert") {
    return { extraRound: false, timing: "conditional", allowThrowSuppress: true, declareAmbush: false };
  }
  if (difficulty === "trained") {
    return { extraRound: false, timing: "conditional", allowThrowSuppress: false, declareAmbush: true };
  }
  return { extraRound: false, timing: "immediate", allowThrowSuppress: false, declareAmbush: false };
}

export function shouldReroll(professional: boolean, keyCheck: boolean): boolean {
  return professional && keyCheck;
}

/** One LUK point buys one reroll; chain while points remain (Q17). */
export function spendLuckReroll(lukLeft: number): { lukLeft: number; rerolled: boolean } {
  const n = Math.max(0, lukLeft);
  if (n <= 0) return { lukLeft: 0, rerolled: false };
  return { lukLeft: n - 1, rerolled: true };
}

export function preferredFireMode(input: {
  difficulty: NpcDifficultyId;
  available: readonly FireModeId[];
  defaultFireMode: FireModeId;
  poolAllowsBurst: boolean;
  exactEnemyCount: number;
  distanceM: number;
  weaponRangeM: number;
  rng: () => number;
}): FireModeId {
  const has = (mode: FireModeId) => input.available.includes(mode);
  const fallback = (): FireModeId =>
    (["semi", "burst", "auto"] as const).find(has) ?? input.defaultFireMode;

  if (input.difficulty === "newstupid") return input.defaultFireMode;
  if (input.difficulty === "novice") return has("semi") ? "semi" : fallback();
  if (input.difficulty === "expert") {
    if (has("auto")) return "auto";
    if (has("burst")) return "burst";
    return has("semi") ? "semi" : fallback();
  }
  if (input.difficulty === "professional") {
    if (has("burst") && input.poolAllowsBurst) return "burst";
    if (has("auto") && input.exactEnemyCount > 0) return "auto";
    return has("semi") ? "semi" : fallback();
  }
  const range = Math.max(input.weaponRangeM, 1e-3);
  if (input.distanceM <= POINT_BLANK_M && has("auto")) return "auto";
  if (input.distanceM <= range * 0.25 && has("auto") && input.rng() < 0.25) return "auto";
  if (input.distanceM <= range * 0.5 && input.distanceM > range * 0.25) {
    if (has("burst")) return "burst";
    return has("semi") ? "semi" : fallback();
  }
  if (has("burst")) return "burst";
  return has("semi") ? "semi" : fallback();
}

export function preferredHitLocation(input: {
  difficulty: NpcDifficultyId;
  hitEvPositive: boolean;
  canPenArmor: boolean;
  immediatelyLethal: boolean;
  rng: () => number;
}): HitLocationPref {
  if (input.difficulty === "newstupid" || input.difficulty === "novice") return "none";
  if (input.difficulty === "trained") return input.rng() < 0.5 ? "body" : "none";
  if (input.difficulty === "expert") {
    if (input.hitEvPositive && input.canPenArmor) return "chest";
    return input.immediatelyLethal ? "chest" : "unarmored";
  }
  if (!input.hitEvPositive) return "chest";
  if (input.canPenArmor && input.immediatelyLethal) return "head";
  if (input.canPenArmor) return input.immediatelyLethal ? "head" : "unarmored";
  return "unarmored";
}

export function shouldThrowBack(
  difficulty: NpcDifficultyId,
  allowed: boolean,
  rng: () => number,
): boolean {
  if (!allowed) return false;
  if (difficulty === "professional") return true;
  if (difficulty === "expert") return rng() < 0.5;
  if (difficulty === "trained") return rng() < 0.25;
  return false;
}

export function preferredAimPlan(input: {
  difficulty: NpcDifficultyId;
  hitEvPositive: boolean;
  keyKill: boolean;
  rng: () => number;
}): AimPlan {
  if (input.difficulty === "newstupid") return { rounds: 0, target: "none" };
  if (input.difficulty === "novice") {
    return input.rng() < 0.1 ? { rounds: 1, target: "body" } : { rounds: 0, target: "none" };
  }
  if (input.difficulty === "trained") {
    return input.rng() < 0.5 ? { rounds: 1, target: "body" } : { rounds: 0, target: "none" };
  }
  if (input.difficulty === "expert") return { rounds: 0, target: "center_mass" };
  if (input.hitEvPositive && input.keyKill) return { rounds: 2, target: "key_kill" };
  return { rounds: 0, target: "none" };
}

export function concealWhenExpectedKilled(
  difficulty: NpcDifficultyId,
  expectedKilled: boolean,
  rng: () => number,
): ConcealChoice {
  if (!expectedKilled) return "none";
  if (difficulty === "newstupid") return "none";
  if (difficulty === "novice") return rng() < 0.75 ? "nearest_cover" : "none";
  if (difficulty === "trained") return rng() < 0.5 ? "conceal" : "nearest_cover";
  return "conceal";
}
