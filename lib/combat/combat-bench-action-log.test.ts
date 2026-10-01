import assert from "node:assert/strict";
import test from "node:test";

import { buildCombatBenchActionLog, initiativeDiceRolls } from "./combat-bench-action-log.ts";

test("initiativeDiceRolls exposes d10 faces and total", () => {
  const rolls = initiativeDiceRolls([
    {
      placementId: "a",
      label: "A",
      team: "hostile",
      initiativePool: 30,
      profileId: "trained",
      isDecider: true,
      ref: 6,
      initiativeBonus: 0,
      d10Faces: [4],
      roll: 10,
    },
  ]);
  assert.deepEqual(rolls[0]?.dieFaces, [4]);
  assert.equal(rolls[0]?.total, 10);
  assert.match(rolls[0]?.formula ?? "", /1d10.*REF 6/);
});

test("buildCombatBenchActionLog lists initiative then steps", () => {
  const log = buildCombatBenchActionLog({
    deciderPlacementId: "a",
    randomSeed: 1,
    initiativeOrder: [
      {
        placementId: "a",
        label: "A",
        team: "hostile",
        initiativePool: 30,
        profileId: "trained",
        isDecider: true,
        ref: 5,
        initiativeBonus: 0,
        d10Faces: [4],
        roll: 9,
      },
    ],
    turnSequence: [],
    turnIndex: 0,
    plansByPlacementId: {},
    topOptionsByPlacementId: {},
    combatRound: 1,
    healthByPlacementId: {},
    combatEnded: false,
    endReason: null,
    stepLog: [
      {
        stepIndex: 0,
        combatRound: 1,
        turnIndexBefore: 0,
        turn: { placementId: "a", label: "A", slot: 0, isDecider: true },
        label: "A · 移动 1m",
        actorPlacementId: "a",
        actorPosition: { x: 1, y: 0 },
        healthByPlacementId: {},
        actionDescriptions: ["R1 move→ (1.0, 0.0) m · immediate"],
        diceRolls: [],
      },
    ],
  } as never);
  assert.equal(log.length, 2);
  assert.equal(log[0]?.category, "initiative");
  assert.equal(log[0]?.summary, "先攻");
  assert.match(log[0]?.detailLines[0] ?? "", /A 4\+5=9/);
  assert.equal(log[0]?.diceRolls[0]?.dieFaces[0], 4);
  assert.equal(log[1]?.category, "step");
  assert.equal(log[1]?.summary, "A · 段 1");
  assert.equal(log[1]?.detailLines[0], "移动 (1, 0) · 即时");
});

test("buildCombatBenchActionLog shows suppress ammo spent and remaining", () => {
  const log = buildCombatBenchActionLog({
    deciderPlacementId: "a",
    randomSeed: 1,
    initiativeOrder: [],
    turnSequence: [],
    turnIndex: 0,
    plansByPlacementId: {},
    topOptionsByPlacementId: {},
    combatRound: 1,
    healthByPlacementId: {},
    combatEnded: false,
    endReason: null,
    stepLog: [
      {
        stepIndex: 0,
        combatRound: 1,
        turnIndexBefore: 0,
        turn: { placementId: "a", label: "A", slot: 0, isDecider: true },
        label: "A · 压制",
        actorPlacementId: "a",
        actorPosition: { x: 0, y: 0 },
        healthByPlacementId: {},
        actionDescriptions: ["R1 suppressive_fire · immediate", "压制 耗弹30 剩0"],
        diceRolls: [],
      },
    ],
  } as never);
  assert.deepEqual(log[1]?.detailLines, ["压制 · 即时", "耗弹 30 · 剩 0"]);
});
