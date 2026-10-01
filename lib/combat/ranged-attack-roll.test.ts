import assert from "node:assert/strict";
import test from "node:test";

import {
  d10HitChance,
  formatRangedAttackCheckFormula,
  rangedAttackCheckTerms,
  rangedAttackDifficulty,
  rangedAttackDifficultyBreakdown,
  rollRangedAttackCheck,
} from "./ranged-attack-roll.ts";

test("rangedAttackDifficultyBreakdown splits range localization cover", () => {
  const parts = rangedAttackDifficultyBreakdown({
    distanceM: 10,
    weaponRangeM: 350,
    localization: "exact",
  });
  assert.equal(parts.range, 15);
  assert.equal(parts.localization, 5);
  assert.equal(parts.cover, 0);
  assert.equal(parts.total, 20);
});

test("d10HitChance is the share of faces that meet the difficulty", () => {
  assert.equal(d10HitChance(5, 10), 0.6);
  assert.equal(d10HitChance(0, 15), 0);
  assert.equal(d10HitChance(20, 15), 1);
});

test("rangedAttackDifficulty uses range band and exact localization", () => {
  assert.equal(
    rangedAttackDifficulty({
      distanceM: 10,
      weaponRangeM: 350,
      localization: "full",
    }),
    15,
  );
  assert.equal(
    rangedAttackDifficulty({
      distanceM: 10,
      weaponRangeM: 350,
      localization: "exact",
    }),
    20,
  );
});

test("formatRangedAttackCheckFormula lists spec skill stat and sourced modifiers", () => {
  assert.equal(
    formatRangedAttackCheckFormula(9, [
      { value: 4, label: "专精" },
      { value: 3, label: "技能" },
      { value: 6, label: "属性" },
      { value: -3, label: "惩罚", source: "连续射击" },
      { value: 2, label: "增益", source: "瞄准" },
    ]),
    "1d10[9]+4专精+3技能+6属性-3惩罚（连续射击）+2增益（瞄准）",
  );
  assert.equal(formatRangedAttackCheckFormula(4, []), "1d10[4]");
});

test("rangedAttackCheckTerms skips zero parts and names malus sources", () => {
  assert.deepEqual(
    rangedAttackCheckTerms(
      { linkedStat: 6, skillLevel: 3, specializationBonus: 0 },
      { unified: -3, consecutiveFire: -3 },
    ),
    [
      { value: 3, label: "技能" },
      { value: 6, label: "属性" },
      { value: -3, label: "惩罚", source: "统一动作" },
      { value: -3, label: "惩罚", source: "连续射击" },
    ],
  );
});

test("rollRangedAttackCheck rolls d10 then adds bonus", () => {
  const check = rollRangedAttackCheck({
    attackBonus: 7,
    rng: () => 0.4,
  });
  assert.equal(check.d10, 5);
  assert.equal(check.total, 12);
});
