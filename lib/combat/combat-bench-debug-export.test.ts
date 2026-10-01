import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatBenchRoundDebugJson,
  serializeCombatBenchRoundDebug,
} from "./combat-bench-debug-export.ts";

test("buildCombatBenchRoundDebugJson includes turn and unit summaries", () => {
  const session = {
    turnIndex: 1,
    turnSequence: [{ placementId: "a", label: "A", slot: 0, isDecider: true }],
    initiativeOrder: [],
    deciderPlacementId: "a",
    plansByPlacementId: {
      a: {
        snapshot: { position: { x: 1, y: 2 }, initiativeRemaining: 10, initiativeTotal: 10 },
        payload: {
          shape: { initiativeRounds: 1 },
          stancePositions: [{ x: 1, y: 2 }],
          feasibility: { legal: [1, 0] },
        },
        plan: { actions: [], snapshotVersion: 1, randomSeed: 1, completedDepth: 0, totalUtility: 0, timedOut: false },
      },
    },
    topOptionsByPlacementId: { a: [] },
    randomSeed: 1,
    stepLog: [{ stepIndex: 0, combatRound: 1, actorPlacementId: "a", actorPosition: { x: 1, y: 2 },
      actionDescriptions: ["移动 1m"], diceRolls: [] }],
    combatRound: 1,
    healthByPlacementId: { a: { current: 10, max: 10 } },
    combatEnded: false,
    endReason: null,
  };
  const json = buildCombatBenchRoundDebugJson({
    session: session as never,
    placements: [{ id: "a", sheetId: "s", label: "A", x: 1, y: 2, team: "friendly" as const }],
    placementLabelById: new Map([["a", "A"]]),
  });
  assert.equal(json.turnIndex, 1);
  assert.equal(json.randomSeed, 1);
  assert.deepEqual(JSON.parse(serializeCombatBenchRoundDebug(json)).stepLog, session.stepLog);
  assert.ok(json.units.a);
  assert.equal(json.units.a!.payloadSummary.legalCells, 1);
  assert.ok(serializeCombatBenchRoundDebug(json).includes('"turnIndex": 1'));
});
