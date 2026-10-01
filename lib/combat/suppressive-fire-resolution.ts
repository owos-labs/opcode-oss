import { rollOpcodeD10 } from "./bench-health-damage.ts";

/** Reflex save (1d10 + REF + athletics) vs suppress shooter total (出目). */
export function rollAgilitySaveAgainstSuppress(input: {
  ref: number;
  athletics: number;
  attackTotal: number;
  rng: () => number;
}): { d10: number; total: number; success: boolean } {
  const d10 = rollOpcodeD10(input.rng);
  const total = d10 + input.ref + input.athletics;
  return { d10, total, success: total >= input.attackTotal };
}

/** 1d sides: ammo spent this suppress minus rounds already assigned to other targets. */
export function suppressiveHitDieSides(ammoRemainingUnassigned: number): number {
  return Math.max(0, Math.floor(ammoRemainingUnassigned));
}

/** Shooter total minus this target's hit difficulty (成功数, floored at 0). */
export function suppressiveMarginHits(attackTotal: number, hitDifficulty: number): number {
  return Math.max(0, Math.floor(attackTotal - hitDifficulty));
}

export function rollUniformPositiveInt(sides: number, rng: () => number): number {
  const s = Math.max(1, Math.floor(sides));
  return 1 + Math.floor(rng() * s);
}

/** min(1d(remaining ammo), 成功数), capped by remaining ammo. */
export function resolveSuppressiveHitCount(input: {
  ammoRemainingUnassigned: number;
  successCount: number;
  rng: () => number;
}): { dieSides: number; dieRoll: number; hits: number } {
  const dieSides = suppressiveHitDieSides(input.ammoRemainingUnassigned);
  if (dieSides <= 0) {
    return { dieSides: 0, dieRoll: 0, hits: 0 };
  }
  const dieRoll = rollUniformPositiveInt(dieSides, input.rng);
  const success = Math.max(0, Math.floor(input.successCount));
  const hits = Math.min(dieSides, Math.min(dieRoll, success));
  return { dieSides, dieRoll, hits };
}
