import type { OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
import type { BenchPlacementHealthState } from "./combat-bench-outcome.ts";
import { BENCH_HEALTH_PART_LABELS } from "./combat-bench-health.ts";

export function rollOpcodeD10(rng: () => number): number {
  return 1 + Math.floor(rng() * 10);
}

/** Opcode D10 命中部位表（未指定受击目标时）。 */
export function opcodeHitPartFromD10(d10: number): OpcodeHealthPart {
  if (d10 === 10) return "head";
  if (d10 >= 7) return "torso";
  if (d10 === 5) return "hand_primary";
  if (d10 === 6) return "hand_secondary";
  if (d10 <= 2) return "leg_left";
  return "leg_right";
}

export function benchHealthMode(
  state: BenchPlacementHealthState | undefined,
): "simple" | "normal" {
  return state?.mode === "normal" ? "normal" : "simple";
}

function sumPartCurrents(
  parts: Record<OpcodeHealthPart, { current: number; max: number }>,
): number {
  let total = 0;
  for (const key of OPCODE_HEALTH_PARTS) total += parts[key].current;
  return total;
}

export type ApplyBenchDamageResult = {
  state: BenchPlacementHealthState;
  hitPart: OpcodeHealthPart | null;
  effectiveDamage: number;
  simpleCrit: boolean;
  headLethal: boolean;
};

export function applyDamageToBenchPlacement(
  state: BenchPlacementHealthState,
  input: {
    damage: number;
    /** normal 模式：部位；省略时由调用方掷位。 */
    hitPart?: OpcodeHealthPart;
    /** simple 模式：攻击骰自然 10 → ×2 伤害。 */
    attackNatural10?: boolean;
  },
): ApplyBenchDamageResult {
  const damageIn = Math.max(0, Math.floor(input.damage));
  if (damageIn <= 0 || state.current === null) {
    return {
      state,
      hitPart: input.hitPart ?? null,
      effectiveDamage: 0,
      simpleCrit: false,
      headLethal: false,
    };
  }

  const mode = benchHealthMode(state);

  if (mode === "simple") {
    const simpleCrit = input.attackNatural10 === true;
    const effectiveDamage = simpleCrit ? damageIn * 2 : damageIn;
    const current = Math.max(0, state.current - effectiveDamage);
    return {
      state: { ...state, mode: "simple", current },
      hitPart: null,
      effectiveDamage,
      simpleCrit,
      headLethal: false,
    };
  }

  const parts = state.parts;
  if (!parts) {
    const current = Math.max(0, state.current - damageIn);
    return {
      state: { ...state, mode: "normal", current },
      hitPart: input.hitPart ?? "torso",
      effectiveDamage: damageIn,
      simpleCrit: false,
      headLethal: false,
    };
  }

  const hitPart = input.hitPart ?? "torso";
  const row = parts[hitPart];
  const nextPart = Math.max(0, row.current - damageIn);
  const nextParts = {
    ...parts,
    [hitPart]: { ...row, current: nextPart },
  };
  const headLethal = hitPart === "head" && nextPart === 0;
  const current = headLethal ? 0 : sumPartCurrents(nextParts);

  return {
    state: {
      ...state,
      mode: "normal",
      parts: nextParts,
      current,
    },
    hitPart,
    effectiveDamage: damageIn,
    simpleCrit: false,
    headLethal,
  };
}

export function formatBenchHitPartLabel(part: OpcodeHealthPart): string {
  return BENCH_HEALTH_PART_LABELS[part];
}
