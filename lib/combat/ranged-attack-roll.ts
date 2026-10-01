import type {
  CombatLocalizationLevel,
  CoverHeightBand,
} from "../combat-ai/cover-concealment-view.ts";
import {
  localizationHitDifficultyAdd,
  targetCoverHitDifficultyAdd,
} from "./localization.ts";
import { rangeBandDifficulty } from "./range-difficulty.ts";

export function rangedAttackDifficultyBreakdown(input: {
  distanceM: number;
  weaponRangeM: number;
  localization: CombatLocalizationLevel;
  coverBand?: CoverHeightBand;
}): { total: number; range: number; localization: number; cover: number } {
  const range = rangeBandDifficulty(input.distanceM, input.weaponRangeM);
  const localization = localizationHitDifficultyAdd(input.localization);
  const cover = targetCoverHitDifficultyAdd(input.coverBand);
  return { total: range + localization + cover, range, localization, cover };
}

/** 1.7 远程攻击难度（射程档 + 定位 + 掩体高度，不叠加目标大小）。 */
export function rangedAttackDifficulty(input: {
  distanceM: number;
  weaponRangeM: number;
  localization: CombatLocalizationLevel;
  coverBand?: CoverHeightBand;
}): number {
  return rangedAttackDifficultyBreakdown(input).total;
}

/** Fraction of 1d10 faces where face + attackBonus meets difficulty. */
export function d10HitChance(attackBonus: number, difficulty: number): number {
  const need = Math.ceil(difficulty - attackBonus);
  if (need <= 1) return 1;
  if (need > 10) return 0;
  return (11 - need) / 10;
}

/** 1D10 检定加值：关键属性 + 技能 + 专精 + 动作减值（负值）。 */
export function rangedAttackRollBonus(bonus: number): number {
  return bonus;
}

export function rollRangedAttackCheck(input: {
  attackBonus: number;
  rng: () => number;
}): { d10: number; bonus: number; total: number } {
  const d10 = 1 + Math.floor(input.rng() * 10);
  const bonus = input.attackBonus;
  return { d10, bonus, total: d10 + bonus };
}

export type RangedAttackCheckTerm = {
  value: number;
  label: "专精" | "技能" | "属性" | "惩罚" | "增益";
  source?: string;
};

/** `1d10[face]+X专精+X技能+X属性+X惩罚（来源）+X增益（来源）`. Zero terms omitted. */
export function formatRangedAttackCheckFormula(
  d10: number,
  terms: readonly RangedAttackCheckTerm[],
): string {
  let text = `1d10[${d10}]`;
  for (const term of terms) {
    if (!term.value) continue;
    const n = term.value > 0 ? `+${term.value}` : String(term.value);
    const source = term.source ? `（${term.source}）` : "";
    text += `${n}${term.label}${source}`;
  }
  return text;
}

export function rangedAttackCheckTerms(
  parts: {
    linkedStat: number;
    skillLevel: number;
    specializationBonus: number;
  },
  malus: { unified: number; consecutiveFire: number },
): RangedAttackCheckTerm[] {
  const terms: RangedAttackCheckTerm[] = [];
  if (parts.specializationBonus) {
    terms.push({ value: parts.specializationBonus, label: "专精" });
  }
  if (parts.skillLevel) terms.push({ value: parts.skillLevel, label: "技能" });
  if (parts.linkedStat) terms.push({ value: parts.linkedStat, label: "属性" });
  if (malus.unified) terms.push({ value: malus.unified, label: "惩罚", source: "统一动作" });
  if (malus.consecutiveFire) {
    terms.push({ value: malus.consecutiveFire, label: "惩罚", source: "连续射击" });
  }
  return terms;
}
