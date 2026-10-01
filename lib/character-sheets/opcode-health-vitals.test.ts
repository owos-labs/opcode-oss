import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOpcodeVitalsAfterDamage,
  opcodeDeathSaveDifficulty,
  opcodePlacementIncapacitated,
  opcodeStunSaveDifficulty,
  opcodeVitalsBarClass,
  readOpcodeVitalsFromStatusHealth,
} from "./opcode-health-vitals.ts";

test("opcodeVitalsBarClass picks bar color by stun ratio", () => {
  assert.equal(opcodeVitalsBarClass(0), "bg-primary");
  assert.equal(opcodeVitalsBarClass(0.74), "bg-primary");
  assert.equal(opcodeVitalsBarClass(0.75), "bg-warning");
  assert.equal(opcodeVitalsBarClass(0.99), "bg-warning");
  assert.equal(opcodeVitalsBarClass(1), "bg-error");
});

test("opcodeStunSaveDifficulty is 10 + stun gauge", () => {
  assert.equal(opcodeStunSaveDifficulty(0), 10);
  assert.equal(opcodeStunSaveDifficulty(7), 17);
});

test("opcodeDeathSaveDifficulty floors at 10 after reduction", () => {
  assert.equal(opcodeDeathSaveDifficulty(5, 0), 15);
  assert.equal(opcodeDeathSaveDifficulty(5, 3), 12);
  assert.equal(opcodeDeathSaveDifficulty(2, 5), 10);
});

test("applyOpcodeVitalsAfterDamage fills stun gauge and marks unconscious at max", () => {
  const next = applyOpcodeVitalsAfterDamage(
    {
      stunGauge: 18,
      stunPenalty: 0,
      damageTaken: 0,
      deathSaveDifficultyReduction: 0,
      unconscious: false,
      deathSave: false,
      dead: false,
    },
    { damage: 3, maxHp: 20 },
  );
  assert.equal(next.stunGauge, 20);
  assert.equal(next.damageTaken, 3);
  assert.equal(next.unconscious, true);
});

test("applyOpcodeVitalsAfterDamage head lethal marks dead", () => {
  const next = applyOpcodeVitalsAfterDamage(
    {
      stunGauge: 0,
      stunPenalty: 0,
      damageTaken: 0,
      deathSaveDifficultyReduction: 0,
      unconscious: false,
      deathSave: false,
      dead: false,
    },
    { damage: 2, maxHp: 20, headLethal: true },
  );
  assert.equal(next.dead, true);
});

test("opcodePlacementIncapacitated respects vitals flags", () => {
  assert.equal(opcodePlacementIncapacitated({ current: 5, vitals: null }), false);
  assert.equal(
    opcodePlacementIncapacitated({
      current: 3,
      vitals: { ...readOpcodeVitalsFromStatusHealth({}), unconscious: true },
    }),
    true,
  );
  assert.equal(
    opcodePlacementIncapacitated({
      current: 0,
      vitals: {
        ...readOpcodeVitalsFromStatusHealth({}),
        deathSave: true,
      },
    }),
    true,
  );
  assert.equal(
    opcodePlacementIncapacitated({
      current: 0,
      vitals: readOpcodeVitalsFromStatusHealth({}),
    }),
    false,
  );
});
