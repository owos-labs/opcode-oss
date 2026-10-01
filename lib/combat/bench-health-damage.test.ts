import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDamageToBenchPlacement,
  opcodeHitPartFromD10,
  rollOpcodeD10,
} from "./bench-health-damage.ts";
import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { initBenchPlacementHealth } from "./combat-bench-outcome.ts";

test("opcodeHitPartFromD10 matches Opcode 健康系统 d10 表", () => {
  assert.equal(opcodeHitPartFromD10(10), "head");
  assert.equal(opcodeHitPartFromD10(7), "torso");
  assert.equal(opcodeHitPartFromD10(9), "torso");
  assert.equal(opcodeHitPartFromD10(5), "hand_primary");
  assert.equal(opcodeHitPartFromD10(6), "hand_secondary");
  assert.equal(opcodeHitPartFromD10(1), "leg_left");
  assert.equal(opcodeHitPartFromD10(2), "leg_left");
  assert.equal(opcodeHitPartFromD10(3), "leg_right");
  assert.equal(opcodeHitPartFromD10(4), "leg_right");
});

test("applyDamageToBenchPlacement simple mode doubles on natural 10", () => {
  const applied = applyDamageToBenchPlacement(
    { mode: "simple", current: 20, max: 20 },
    { damage: 5, attackNatural10: true },
  );
  assert.equal(applied.effectiveDamage, 10);
  assert.equal(applied.state.current, 10);
  assert.equal(applied.simpleCrit, true);
});

test("applyDamageToBenchPlacement normal mode subtracts from hit part", () => {
  const applied = applyDamageToBenchPlacement(
    {
      mode: "normal",
      current: 20,
      max: 20,
      parts: {
        head: { current: 2, max: 2 },
        torso: { current: 6, max: 6 },
        hand_primary: { current: 2, max: 2 },
        hand_secondary: { current: 4, max: 4 },
        leg_left: { current: 3, max: 3 },
        leg_right: { current: 3, max: 3 },
      },
    },
    { damage: 2, hitPart: "leg_left" },
  );
  assert.equal(applied.state.parts!.leg_left.current, 1);
  assert.equal(applied.state.current, 18);
});

test("applyDamageToBenchPlacement head destroyed neutralizes total", () => {
  const applied = applyDamageToBenchPlacement(
    {
      mode: "normal",
      current: 10,
      max: 10,
      parts: {
        head: { current: 1, max: 1 },
        torso: { current: 3, max: 3 },
        hand_primary: { current: 1, max: 1 },
        hand_secondary: { current: 2, max: 2 },
        leg_left: { current: 2, max: 2 },
        leg_right: { current: 1, max: 1 },
      },
    },
    { damage: 3, hitPart: "head" },
  );
  assert.equal(applied.headLethal, true);
  assert.equal(applied.state.current, 0);
});

test("initBenchPlacementHealth loads per-part pools for normal sheets", () => {
  const sheet: CharacterSheet = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Normal HP",
    created_at: "",
    updated_at: "",
    created_by: "",
    character_id: null,
    rule_book: "Opcode",
    version: "1",
    stats: {
      derivated: {
        health: {
          mode: "normal",
          max: 20,
          normal: {
            head: { base: 2, mod: 0 },
            torso: { base: 6, mod: 0 },
            hand_primary: { base: 2, mod: 0 },
            hand_secondary: { base: 4, mod: 0 },
            leg_left: { base: 3, mod: 0 },
            leg_right: { base: 3, mod: 0 },
          },
        },
      },
    },
    status: {
      health: {
        mode: "normal",
        normal: {
          head: { base: 2, mod: 0 },
          torso: { base: 6, mod: 0 },
          hand_primary: { base: 2, mod: 0 },
          hand_secondary: { base: 4, mod: 0 },
          leg_left: { base: 3, mod: 0 },
          leg_right: { base: 3, mod: 0 },
        },
      },
    },
  };
  const map = new Map([[sheet.id, sheet]]);
  const health = initBenchPlacementHealth(
    [{ id: "u1", sheetId: sheet.id, label: "T", team: "a", x: 0, y: 0 }],
    map,
  );
  const row = health.u1!;
  assert.equal(row.mode, "normal");
  assert.ok(row.parts!.torso.max > 0);
  assert.equal(
    row.current,
    row.parts!.torso.current +
      row.parts!.head.current +
      row.parts!.hand_primary.current +
      row.parts!.hand_secondary.current +
      row.parts!.leg_left.current +
      row.parts!.leg_right.current,
  );
});

test("rollOpcodeD10 covers 1..10", () => {
  const faces = new Set<number>();
  for (let i = 0; i < 500; i++) faces.add(rollOpcodeD10(() => i / 500));
  assert.deepEqual([...faces].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
