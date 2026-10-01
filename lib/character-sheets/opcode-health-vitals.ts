import type { OpcodeStatKey } from "./characterSheet.types.ts";

export type OpcodeVitalsFlags = {
  unconscious: boolean;
  deathSave: boolean;
  dead: boolean;
};

export type OpcodeVitalsState = {
  stunGauge: number;
  stunPenalty: number;
  damageTaken: number;
  deathSaveDifficultyReduction: number;
} & OpcodeVitalsFlags;

export const EMPTY_OPCODE_VITALS: OpcodeVitalsState = {
  stunGauge: 0,
  stunPenalty: 0,
  damageTaken: 0,
  deathSaveDifficultyReduction: 0,
  unconscious: false,
  deathSave: false,
  dead: false,
};

export function opcodeVitalsBarClass(ratio: number): string {
  if (ratio >= 1) return "bg-error";
  if (ratio >= 0.75) return "bg-warning";
  return "bg-primary";
}

export function opcodeStunSaveDifficulty(stunGauge: number): number {
  return 10 + Math.max(0, Math.floor(stunGauge));
}

export function opcodeDeathSaveDifficulty(
  damageTaken: number,
  difficultyReduction = 0,
): number {
  const raw = 10 + Math.max(0, Math.floor(damageTaken)) - Math.max(0, Math.floor(difficultyReduction));
  return Math.max(10, raw);
}

export function readSafeHealthInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function readPairEffective(value: unknown): number | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const base = readSafeHealthInt(record.base);
  if (base === null) return null;
  const mod = record.mod === undefined ? 0 : readSafeHealthInt(record.mod);
  if (mod === null) return null;
  return base + mod;
}

function readBool(value: unknown): boolean {
  return value === true;
}

/** Reads stun / death-save runtime fields from `status.health`. */
export function readOpcodeVitalsFromStatusHealth(
  statusHealth: Record<string, unknown>,
): OpcodeVitalsState {
  const flags = statusHealth.flags;
  const flagRecord =
    flags !== null && typeof flags === "object" && !Array.isArray(flags)
      ? (flags as Record<string, unknown>)
      : {};
  return {
    stunGauge: readPairEffective(statusHealth.stun) ?? 0,
    stunPenalty: readPairEffective(statusHealth.stunPenalty) ?? 0,
    damageTaken: readPairEffective(statusHealth.damageTaken) ?? 0,
    deathSaveDifficultyReduction:
      readPairEffective(statusHealth.deathSaveReduction) ?? 0,
    unconscious: readBool(flagRecord.unconscious),
    deathSave: readBool(flagRecord.deathSave),
    dead: readBool(flagRecord.dead),
  };
}

export function buildFreshOpcodeStatusVitals(): Record<string, unknown> {
  return {
    stun: { base: 0, mod: 0 },
    stunPenalty: { base: 0, mod: 0 },
    damageTaken: { base: 0, mod: 0 },
    deathSaveReduction: { base: 0, mod: 0 },
    flags: { unconscious: false, deathSave: false, dead: false },
  };
}

export function clampOpcodeVitalsFields(
  originalHealth: Record<string, unknown>,
  maxHp: number,
): Record<string, unknown> {
  const cap = Math.max(0, maxHp);
  const vitals = readOpcodeVitalsFromStatusHealth(originalHealth);
  return {
    ...originalHealth,
    stun: { base: Math.min(cap, Math.max(0, vitals.stunGauge)), mod: 0 },
    stunPenalty: { base: Math.max(0, vitals.stunPenalty), mod: 0 },
    damageTaken: { base: Math.max(0, vitals.damageTaken), mod: 0 },
    deathSaveReduction: {
      base: Math.max(0, vitals.deathSaveDifficultyReduction),
      mod: 0,
    },
    flags: {
      unconscious: vitals.unconscious,
      deathSave: vitals.deathSave,
      dead: vitals.dead,
    },
  };
}

export type ApplyOpcodeVitalsDamageInput = {
  damage: number;
  maxHp: number;
  headLethal?: boolean;
  simplePoolZero?: boolean;
};

/** Updates stun gauge and incapacitation flags after resolved damage. */
export function applyOpcodeVitalsAfterDamage(
  vitals: OpcodeVitalsState,
  input: ApplyOpcodeVitalsDamageInput,
): OpcodeVitalsState {
  const damage = Math.max(0, Math.floor(input.damage));
  const maxHp = Math.max(0, Math.floor(input.maxHp));
  if (damage <= 0 && !input.headLethal && !input.simplePoolZero) return vitals;

  let next: OpcodeVitalsState = {
    ...vitals,
    damageTaken: vitals.damageTaken + damage,
    stunGauge: Math.min(maxHp, vitals.stunGauge + damage),
  };

  if (input.headLethal) {
    next = { ...next, dead: true, unconscious: false };
  }
  if (input.simplePoolZero) {
    next = { ...next, deathSave: true };
  }
  if (maxHp > 0 && next.stunGauge >= maxHp) {
    next = { ...next, unconscious: true };
  }
  return next;
}

export function opcodePlacementIncapacitated(input: {
  current: number | null;
  vitals?: OpcodeVitalsState | null;
}): boolean {
  const vitals = input.vitals ?? EMPTY_OPCODE_VITALS;
  if (vitals.dead || vitals.unconscious) return true;
  if (vitals.deathSave && input.current !== null && input.current <= 0) return true;
  return false;
}

export function opcodeSaveStatKeys(kind: "stun" | "death"): OpcodeStatKey[] {
  return kind === "stun" ? ["wil"] : ["bod"];
}
