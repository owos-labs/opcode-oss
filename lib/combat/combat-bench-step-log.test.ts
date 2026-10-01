import assert from "node:assert/strict";
import test from "node:test";

import {
  appendCombatBenchStepLog,
  groupStepLogByCombatRound,
} from "./combat-bench-step-log.ts";

test("groupStepLogByCombatRound buckets by combatRound", () => {
  const log = appendCombatBenchStepLog([], {
    combatRound: 1,
    turnIndexBefore: 0,
    turn: null,
    label: "a",
    actorPlacementId: "p1",
    actorPosition: { x: 0, y: 0 },
    healthByPlacementId: {},
    actionDescriptions: [],
  });
  const log2 = appendCombatBenchStepLog(log, {
    combatRound: 2,
    turnIndexBefore: 1,
    turn: null,
    label: "b",
    actorPlacementId: "p1",
    actorPosition: { x: 1, y: 0 },
    healthByPlacementId: {},
    actionDescriptions: ["move"],
    enteredNewCombatRound: 2,
  });
  const grouped = groupStepLogByCombatRound(log2);
  assert.equal(grouped[1]?.length, 1);
  assert.equal(grouped[2]?.length, 1);
  assert.equal(grouped[2]?.[0]?.actionDescriptions[0], "move");
});
