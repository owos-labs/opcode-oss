import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOpcodeNormalDamage,
  expectedExplosiveNormalDamage,
  expectedNormalHitOnPart,
  freshOpcodePartRuntime,
  opcodePartsFromBenchParts,
} from "./opcode-part-health.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";

function sampleParts() {
  const raw = {
    head: { current: 2, max: 2 },
    torso: { current: 6, max: 6 },
    hand_primary: { current: 2, max: 2 },
    hand_secondary: { current: 2, max: 2 },
    leg_left: { current: 4, max: 4 },
    leg_right: { current: 4, max: 4 },
  };
  return opcodePartsFromBenchParts(raw);
}

test("applyOpcodeNormalDamage head destroy marks dead", () => {
  const parts = sampleParts();
  const result = applyOpcodeNormalDamage({
    parts,
    maxHp: 20,
    damage: 3,
    hitPart: "head",
    saves: { wil: 5, bod: 5, fortitude: 0 },
    rng: () => 0.99,
  });
  assert.equal(result.headLethal, true);
  assert.equal(result.vitals.dead, true);
  assert.ok(result.events.some((e) => e.kind === "head_lethal"));
});

test("applyOpcodeNormalDamage overflow severs limb", () => {
  const parts = sampleParts();
  const result = applyOpcodeNormalDamage({
    parts,
    maxHp: 20,
    damage: 5,
    hitPart: "hand_primary",
    saves: { wil: 5, bod: 5, fortitude: 0 },
    rng: () => 0.99,
  });
  assert.equal(result.parts.hand_primary.current, 0);
  assert.equal(result.parts.hand_primary.severed, true);
  assert.ok(result.events.some((e) => e.kind === "sever"));
});

test("applyOpcodeNormalDamage explosive splits across all parts", () => {
  const parts = sampleParts();
  const beforeByPart = Object.fromEntries(
    OPCODE_HEALTH_PARTS.map((key) => [key, parts[key].current]),
  ) as Record<(typeof OPCODE_HEALTH_PARTS)[number], number>;
  const before = OPCODE_HEALTH_PARTS.reduce((sum, key) => sum + beforeByPart[key], 0);
  const result = applyOpcodeNormalDamage({
    parts,
    maxHp: 20,
    damage: 12,
    explosive: true,
    saves: { wil: 5, bod: 5, fortitude: 0 },
    rng: () => 0.99,
  });
  assert.equal(result.totalPartDamage, 12);
  const after = OPCODE_HEALTH_PARTS.reduce((sum, key) => sum + result.parts[key].current, 0);
  assert.ok(after < before);
  for (const key of OPCODE_HEALTH_PARTS) {
    assert.equal(result.parts[key].current, beforeByPart[key] - 2);
  }
});

test("destroyed limb splashes damage to neighbors", () => {
  const parts = sampleParts();
  parts.hand_primary = freshOpcodePartRuntime(2, 0);
  parts.hand_primary.destroyed = true;
  const result = applyOpcodeNormalDamage({
    parts,
    maxHp: 20,
    damage: 4,
    hitPart: "hand_primary",
    rng: () => 0.99,
  });
  assert.ok(result.events.some((e) => e.kind === "splash" && e.from === "hand_primary"));
  assert.ok(result.parts.torso.current < 6);
});

test("expectedNormalHitOnPart weights head kill", () => {
  const parts = sampleParts();
  const outcome = expectedNormalHitOnPart(parts, {
    stunGauge: 0,
    stunPenalty: 0,
    damageTaken: 0,
    deathSaveDifficultyReduction: 0,
    unconscious: false,
    deathSave: false,
    dead: false,
  }, "head", 3);
  assert.equal(outcome.headKillProbability, 1);
  assert.equal(outcome.poolLoss, 2);
});

test("expectedExplosiveNormalDamage applies share to each part", () => {
  const parts = sampleParts();
  const outcome = expectedExplosiveNormalDamage(
    parts,
    {
      stunGauge: 0,
      stunPenalty: 0,
      damageTaken: 0,
      deathSaveDifficultyReduction: 0,
      unconscious: false,
      deathSave: false,
      dead: false,
    },
    12,
  );
  assert.equal(outcome.stunGain, 12);
  assert.ok(outcome.poolLoss > 0);
});
