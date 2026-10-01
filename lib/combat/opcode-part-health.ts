import type { OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
import {
  applyOpcodeVitalsAfterDamage,
  EMPTY_OPCODE_VITALS,
  type OpcodeVitalsState,
} from "../character-sheets/opcode-health-vitals.ts";

export type OpcodePartRuntime = {
  current: number;
  max: number;
  destroyed: boolean;
  severed: boolean;
  /** Damage taken while destroyed, toward sever threshold (>5). */
  postDestroyDamage: number;
};

export type OpcodeSaveStats = {
  wil: number;
  bod: number;
  fortitude: number;
};

export const OPCODE_PART_NEIGHBORS: Record<OpcodeHealthPart, readonly OpcodeHealthPart[]> = {
  head: ["torso"],
  torso: ["head", "hand_primary", "hand_secondary", "leg_left", "leg_right"],
  hand_primary: ["torso", "hand_secondary"],
  hand_secondary: ["torso", "hand_primary"],
  leg_left: ["torso", "leg_right"],
  leg_right: ["torso", "leg_left"],
};

export type OpcodePartDamageEvent =
  | { kind: "destroy"; part: OpcodeHealthPart }
  | { kind: "sever"; part: OpcodeHealthPart }
  | { kind: "stun_save"; part: OpcodeHealthPart; passed: boolean; failBy: number }
  | { kind: "death_save"; part: OpcodeHealthPart; passed: boolean; failBy: number }
  | { kind: "head_lethal" }
  | { kind: "splash"; from: OpcodeHealthPart; to: OpcodeHealthPart; damage: number };

export function freshOpcodePartRuntime(max: number, current = max): OpcodePartRuntime {
  const cur = Math.max(0, Math.min(max, current));
  return {
    current: cur,
    max,
    destroyed: cur <= 0,
    severed: false,
    postDestroyDamage: 0,
  };
}

export function cloneOpcodePartMap(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
): Record<OpcodeHealthPart, OpcodePartRuntime> {
  const out = {} as Record<OpcodeHealthPart, OpcodePartRuntime>;
  for (const key of OPCODE_HEALTH_PARTS) {
    out[key] = { ...parts[key] };
  }
  return out;
}

function sumPartCurrents(parts: Record<OpcodeHealthPart, OpcodePartRuntime>): number {
  let total = 0;
  for (const key of OPCODE_HEALTH_PARTS) total += parts[key].current;
  return total;
}

function rollD10(rng: () => number): number {
  return 1 + Math.floor(rng() * 10);
}

function rollStunSave(
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats,
  rng: () => number,
): { passed: boolean; failBy: number; roll: number; dc: number } {
  const roll = rollD10(rng) + stats.wil + stats.fortitude;
  const dc = 10 + vitals.stunGauge;
  if (roll >= dc) return { passed: true, failBy: 0, roll, dc };
  return { passed: false, failBy: dc - roll, roll, dc };
}

function rollDeathSave(
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats,
  rng: () => number,
): { passed: boolean; failBy: number; roll: number; dc: number } {
  const roll = rollD10(rng) + stats.bod + stats.fortitude;
  const dc = Math.max(
    10,
    10 + vitals.damageTaken - vitals.deathSaveDifficultyReduction,
  );
  if (roll >= dc) return { passed: true, failBy: 0, roll, dc };
  return { passed: false, failBy: dc - roll, roll, dc };
}

function applyStunSaveResult(
  vitals: OpcodeVitalsState,
  failBy: number,
): OpcodeVitalsState {
  if (failBy <= 0) return vitals;
  return { ...vitals, stunPenalty: vitals.stunPenalty + failBy };
}

function runDestroyEffect(
  part: OpcodeHealthPart,
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
): OpcodeVitalsState {
  events.push({ kind: "destroy", part });
  if (part === "head") {
    events.push({ kind: "head_lethal" });
    return { ...vitals, dead: true };
  }
  if (!stats || !rng) return vitals;
  if (part === "torso" || part === "leg_left" || part === "leg_right") {
    const save = rollStunSave(vitals, stats, rng);
    events.push({ kind: "stun_save", part, passed: save.passed, failBy: save.failBy });
    return applyStunSaveResult(vitals, save.failBy);
  }
  return vitals;
}

function runSeverEffect(
  part: OpcodeHealthPart,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
): OpcodeVitalsState {
  events.push({ kind: "sever", part });
  if (!stats || !rng) {
    if (part === "torso" || part === "leg_left" || part === "leg_right") {
      return { ...vitals, deathSave: true };
    }
    return vitals;
  }
  if (
    part === "hand_primary" ||
    part === "hand_secondary" ||
    part === "torso" ||
    part === "leg_left" ||
    part === "leg_right"
  ) {
    if (part === "torso" || part === "leg_left" || part === "leg_right") {
      const death = rollDeathSave(vitals, stats, rng);
      events.push({
        kind: "death_save",
        part,
        passed: death.passed,
        failBy: death.failBy,
      });
      let next = { ...vitals, deathSave: true };
      if (!death.passed) next = { ...next, dead: true };
      else {
        next = {
          ...next,
          deathSaveDifficultyReduction: next.deathSaveDifficultyReduction + 1,
        };
      }
      return next;
    }
    const stun = rollStunSave(vitals, stats, rng);
    events.push({ kind: "stun_save", part, passed: stun.passed, failBy: stun.failBy });
    return applyStunSaveResult(vitals, stun.failBy);
  }
  return vitals;
}

function markSever(
  part: OpcodeHealthPart,
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
): OpcodeVitalsState {
  const row = parts[part];
  if (row.severed) return vitals;
  row.severed = true;
  row.destroyed = true;
  row.current = 0;
  return runSeverEffect(part, vitals, stats, rng, events);
}

function splashDestroyedPart(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  part: OpcodeHealthPart,
  damage: number,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
): { parts: Record<OpcodeHealthPart, OpcodePartRuntime>; vitals: OpcodeVitalsState; applied: number } {
  const row = parts[part];
  if (!row.destroyed || row.severed) {
    return { parts, vitals, applied: 0 };
  }
  const neighbors = OPCODE_PART_NEIGHBORS[part];
  if (!neighbors.length) return { parts, vitals, applied: 0 };
  const share = Math.floor(damage / neighbors.length);
  if (share <= 0) return { parts, vitals, applied: 0 };
  let nextParts = parts;
  let nextVitals = vitals;
  let applied = 0;
  for (const neighbor of neighbors) {
    events.push({ kind: "splash", from: part, to: neighbor, damage: share });
    const hit = strikePart(nextParts, neighbor, share, nextVitals, stats, rng, events, false);
    nextParts = hit.parts;
    nextVitals = hit.vitals;
    applied += share;
  }
  row.postDestroyDamage += damage;
  if (row.postDestroyDamage > 5) {
    nextVitals = markSever(part, nextParts, nextVitals, stats, rng, events);
  }
  return { parts: nextParts, vitals: nextVitals, applied };
}

function strikePart(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  part: OpcodeHealthPart,
  damageIn: number,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
  allowSplash: boolean,
): {
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>;
  vitals: OpcodeVitalsState;
  applied: number;
  headLethal: boolean;
} {
  const damage = Math.max(0, Math.floor(damageIn));
  if (damage <= 0) {
    return { parts, vitals, applied: 0, headLethal: false };
  }

  const row = parts[part];
  if (row.severed) {
    return { parts, vitals, applied: 0, headLethal: false };
  }

  if (allowSplash && row.destroyed && row.current <= 0) {
    const splashed = splashDestroyedPart(parts, part, damage, vitals, stats, rng, events);
    return { parts: splashed.parts, vitals: splashed.vitals, applied: splashed.applied, headLethal: vitals.dead };
  }

  const before = row.current;
  const after = Math.max(0, before - damage);
  const overflow = Math.max(0, damage - before);
  row.current = after;
  let nextVitals = vitals;
  let headLethal = false;

  if (before > 0 && after === 0) {
    row.destroyed = true;
    nextVitals = runDestroyEffect(part, parts, nextVitals, stats, rng, events);
    headLethal = part === "head" && nextVitals.dead;
    if (overflow > 2) {
      nextVitals = markSever(part, parts, nextVitals, stats, rng, events);
    }
  }

  return { parts, vitals: nextVitals, applied: damage, headLethal };
}

function applyDamageToPart(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  part: OpcodeHealthPart,
  damageIn: number,
  vitals: OpcodeVitalsState,
  stats: OpcodeSaveStats | undefined,
  rng: () => number | undefined,
  events: OpcodePartDamageEvent[],
): ReturnType<typeof strikePart> {
  return strikePart(parts, part, damageIn, vitals, stats, rng, events, true);
}

export type ApplyOpcodeNormalDamageInput = {
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>;
  vitals?: OpcodeVitalsState;
  maxHp: number;
  damage: number;
  hitPart?: OpcodeHealthPart;
  explosive?: boolean;
  saves?: OpcodeSaveStats;
  rng?: () => number;
};

export type ApplyOpcodeNormalDamageResult = {
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>;
  vitals: OpcodeVitalsState;
  events: OpcodePartDamageEvent[];
  headLethal: boolean;
  totalPartDamage: number;
};

/** Normal-mode damage: destroy/sever, splash, explosives, saves, vitals. */
export function applyOpcodeNormalDamage(
  input: ApplyOpcodeNormalDamageInput,
): ApplyOpcodeNormalDamageResult {
  const events: OpcodePartDamageEvent[] = [];
  let parts = cloneOpcodePartMap(input.parts);
  let vitals = input.vitals ?? EMPTY_OPCODE_VITALS;
  const rng = input.rng;
  const stats = input.saves;
  const damage = Math.max(0, Math.floor(input.damage));
  if (damage <= 0) {
    return { parts, vitals, events, headLethal: false, totalPartDamage: 0 };
  }

  let totalPartDamage = 0;
  let headLethal = false;

  const hits: Array<{ part: OpcodeHealthPart; amount: number }> = [];
  if (input.explosive) {
    const share = Math.floor(damage / OPCODE_HEALTH_PARTS.length);
    for (const part of OPCODE_HEALTH_PARTS) hits.push({ part, amount: share });
  } else {
    hits.push({ part: input.hitPart ?? "torso", amount: damage });
  }

  for (const hit of hits) {
    const applied = applyDamageToPart(parts, hit.part, hit.amount, vitals, stats, rng, events);
    parts = applied.parts;
    vitals = applied.vitals;
    totalPartDamage += hit.amount;
    headLethal = headLethal || applied.headLethal;
  }

  vitals = applyOpcodeVitalsAfterDamage(vitals, {
    damage: totalPartDamage,
    maxHp: input.maxHp,
    headLethal,
  });

  return { parts, vitals, events, headLethal, totalPartDamage };
}

export function opcodePartsFromBenchParts(
  parts: Record<OpcodeHealthPart, { current: number; max: number } & Partial<OpcodePartRuntime>>,
): Record<OpcodeHealthPart, OpcodePartRuntime> {
  const out = {} as Record<OpcodeHealthPart, OpcodePartRuntime>;
  for (const key of OPCODE_HEALTH_PARTS) {
    const row = parts[key];
    out[key] = {
      current: row.current,
      max: row.max,
      destroyed: row.destroyed ?? row.current <= 0,
      severed: row.severed ?? false,
      postDestroyDamage: row.postDestroyDamage ?? 0,
    };
  }
  return out;
}

export function benchPartsFromOpcodeParts(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
): Record<OpcodeHealthPart, OpcodePartRuntime & { current: number; max: number }> {
  return cloneOpcodePartMap(parts);
}

export function totalCurrentFromOpcodeParts(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  headLethal: boolean,
): number {
  if (headLethal) return 0;
  return sumPartCurrents(parts);
}

/** P(1d10 + modifier < dc), clamped 0..1. */
export function d10SaveFailProbability(modifier: number, dc: number): number {
  const need = dc - modifier;
  if (need <= 1) return 0;
  if (need > 10) return 1;
  return (need - 1) / 10;
}

export type ExpectedNormalHitOutcome = {
  poolLoss: number;
  stunGain: number;
  headKillProbability: number;
  incapProbability: number;
};

/** Mean outcome for one hit on a part (destroy/splash/head kill; saves as fail probability). */
export function expectedNormalHitOnPart(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  vitals: OpcodeVitalsState,
  part: OpcodeHealthPart,
  meanDamage: number,
  stats?: OpcodeSaveStats,
): ExpectedNormalHitOutcome {
  const dmg = Math.max(0, meanDamage);
  if (dmg <= 0) {
    return { poolLoss: 0, stunGain: 0, headKillProbability: 0, incapProbability: 0 };
  }

  const row = parts[part];
  if (row.severed) {
    return { poolLoss: 0, stunGain: 0, headKillProbability: 0, incapProbability: 0 };
  }

  if (row.destroyed && row.current <= 0) {
    const neighbors = OPCODE_PART_NEIGHBORS[part];
    const share = neighbors.length ? Math.floor(dmg / neighbors.length) : 0;
    let poolLoss = 0;
    let stunGain = share * neighbors.length;
    let headKillProbability = 0;
    let incapProbability = 0;
    for (const neighbor of neighbors) {
      const rowBefore = parts[neighbor].current;
      const loss = Math.min(rowBefore, share);
      poolLoss += loss;
      if (neighbor === "head" && rowBefore > 0 && rowBefore - share <= 0) {
        headKillProbability = 1;
        incapProbability = 1;
      }
    }
    return { poolLoss, stunGain, headKillProbability, incapProbability };
  }

  const loss = Math.min(row.current, dmg);
  const overflow = Math.max(0, dmg - row.current);
  let headKillProbability = 0;
  let incapProbability = 0;

  if (row.current > 0 && row.current - dmg <= 0) {
    if (part === "head") {
      headKillProbability = 1;
      incapProbability = 1;
    } else if (part === "torso" || part === "leg_left" || part === "leg_right") {
      if (stats) {
        const fail = d10SaveFailProbability(stats.wil + stats.fortitude, 10 + vitals.stunGauge + loss);
        incapProbability = Math.max(incapProbability, fail * 0.35);
      }
    }
    if (overflow > 2) {
      incapProbability = Math.max(incapProbability, part === "torso" || part === "leg_left" || part === "leg_right" ? 0.55 : 0.25);
    }
  }

  return {
    poolLoss: loss,
    stunGain: dmg,
    headKillProbability,
    incapProbability,
  };
}

export function expectedExplosiveNormalDamage(
  parts: Record<OpcodeHealthPart, OpcodePartRuntime>,
  vitals: OpcodeVitalsState,
  meanTotalDamage: number,
  stats?: OpcodeSaveStats,
): ExpectedNormalHitOutcome {
  const share = Math.floor(meanTotalDamage / OPCODE_HEALTH_PARTS.length);
  let poolLoss = 0;
  let stunGain = 0;
  let headKillProbability = 0;
  let incapProbability = 0;
  for (const part of OPCODE_HEALTH_PARTS) {
    const row = expectedNormalHitOnPart(parts, vitals, part, share, stats);
    poolLoss += row.poolLoss;
    stunGain += row.stunGain;
    headKillProbability = Math.max(headKillProbability, row.headKillProbability);
    incapProbability = Math.max(incapProbability, row.incapProbability);
  }
  return { poolLoss, stunGain, headKillProbability, incapProbability };
}

/** Utility-weighted expected damage for AI (pool + lethality + incap). */
export function expectedNormalDamageUtility(
  outcome: ExpectedNormalHitOutcome,
  maxHp: number,
): number {
  return (
    outcome.poolLoss +
    outcome.headKillProbability * Math.max(1, maxHp) +
    outcome.incapProbability * Math.max(4, maxHp * 0.25)
  );
}
