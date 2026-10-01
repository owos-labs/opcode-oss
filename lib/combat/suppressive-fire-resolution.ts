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

/** Hit-count die: floor(ammo fired this suppress / targets in zone at start). */
export function suppressiveHitDieSides(ammoFiredThisSuppress: number, targetsInZone: number): number {
  const count = Math.max(1, targetsInZone);
  return Math.max(1, Math.floor(ammoFiredThisSuppress / count));
}

/** Shooter total minus this target's hit difficulty (胜出数, floored at 0). */
export function suppressiveMarginHits(attackTotal: number, hitDifficulty: number): number {
  return Math.max(0, attackTotal - hitDifficulty);
}

export function rollUniformPositiveInt(sides: number, rng: () => number): number {
  const s = Math.max(1, Math.floor(sides));
  return 1 + Math.floor(rng() * s);
}

export function suppressiveHitDieForTarget(input: {
  ammoFiredThisSuppress: number;
  initialTargetsInZone: number;
  /** Rounds fired this suppress not yet assigned to a target's hit count. */
  burstUnassigned: number;
  enteredAfterStart: boolean;
}): number {
  if (input.enteredAfterStart) {
    return Math.max(1, input.burstUnassigned);
  }
  return suppressiveHitDieSides(input.ammoFiredThisSuppress, input.initialTargetsInZone);
}

export function resolveSuppressiveHitCount(input: {
  dieSides: number;
  marginHits: number;
  burstUnassigned: number;
  rng: () => number;
}): { dieRoll: number; hits: number } {
  if (input.burstUnassigned <= 0) {
    return { dieRoll: 0, hits: 0 };
  }
  const dieRoll = rollUniformPositiveInt(input.dieSides, input.rng);
  if (input.marginHits <= 0) {
    return { dieRoll, hits: 0 };
  }
  const hits = Math.min(Math.max(dieRoll, input.marginHits), input.burstUnassigned);
  return { dieRoll, hits };
}
