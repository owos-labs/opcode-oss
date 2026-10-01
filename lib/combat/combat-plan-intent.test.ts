import assert from "node:assert/strict";
import test from "node:test";

import { actionFeasibilityIndex, actionKindIndex } from "../combat-ai/action-feasibility.ts";
import {
  feasibilityRoundForSlot,
  formatPlanMoveDebug,
  planGroupedByInitiativeRound,
  planStayReason,
} from "./combat-plan-intent.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

test("planGroupedByInitiativeRound groups actions by round", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "t1"],
  } as PlanningPayload;
  const groups = planGroupedByInitiativeRound(
    payload,
    {
      snapshotVersion: 1,
      randomSeed: 1,
      actions: [
        {
          round: 1,
          kind: actionKindIndex("move"),
          tile: 0,
          target: 0,
          timing: "immediate",
        },
        {
          round: 0,
          kind: actionKindIndex("standard_fire"),
          tile: 0,
          target: 1,
          timing: "immediate",
        },
      ],
      completedDepth: 2,
      totalUtility: 1,
      timedOut: false,
    },
    () => "T",
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.round, 0);
  assert.match(groups[0]!.rows[0]!.text, /standard_fire/);
});

test("feasibilityRoundForSlot maps late turn slots onto replanned tensor rounds", () => {
  const shape = { initiativeRounds: 1, kinds: 10, reachableTiles: 2, targets: 2 };
  assert.equal(feasibilityRoundForSlot(0, shape, []), 0);
  assert.equal(feasibilityRoundForSlot(1, shape, [{ round: 0 }]), 0);
  assert.equal(feasibilityRoundForSlot(2, shape, [{ round: 0 }]), 0);
  assert.equal(feasibilityRoundForSlot(2, shape, []), null);
});

test("planStayReason tolerates turn slot past replanned initiative rounds", () => {
  const fire = actionKindIndex("standard_fire");
  const shape = { initiativeRounds: 1, kinds: 10, reachableTiles: 2, targets: 2 };
  const legal = new Uint8Array(40);
  legal[actionFeasibilityIndex(shape, 0, fire, 0, 1)] = 1;
  assert.doesNotThrow(() =>
    planStayReason({
      payload: {
        stancePositions: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
        targetIds: [null, "t"],
        shape,
        feasibility: { shape, legal },
        utility: new Float32Array(40),
      } as PlanningPayload,
      actions: [{ round: 0, kind: fire, tile: 0, target: 1, timing: "immediate" }],
      slot: 2,
      profileId: "expert",
    }),
  );
});

test("formatPlanMoveDebug and planStayReason explain a hold", () => {
  assert.equal(formatPlanMoveDebug({ x: 0, y: 0 }, { x: 0, y: 0 }), "不移动：移位没有更高分");
  assert.equal(
    formatPlanMoveDebug({ x: 0, y: 0 }, { x: 3, y: 4 }),
    "移动 5.0m → (3.0, 4.0)",
  );
  assert.equal(
    formatPlanMoveDebug({ x: 0, y: 0 }, { x: 3, y: 4 }, undefined, 6.2),
    "移动 6.2m → (3.0, 4.0)",
  );
  const fire = actionKindIndex("standard_fire");
  assert.equal(
    planStayReason({
      payload: {
        stancePositions: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
        targetIds: [null, "t"],
        shape: { initiativeRounds: 1, kinds: 10, reachableTiles: 2, targets: 2 },
        feasibility: { legal: new Uint8Array([0, 0, 1, 1]) },
        utility: new Float32Array([0, 0, 9, 2]),
      } as PlanningPayload,
      actions: [{ round: 0, kind: fire, tile: 0, target: 1, timing: "immediate" }],
      slot: 0,
      profileId: "expert",
    }),
    "本段用于射击，不必换位",
  );
  assert.equal(
    planStayReason({
      payload: { stancePositions: [{ x: 0, y: 0 }] } as PlanningPayload,
      actions: [],
      slot: 0,
      movRemaining: 0,
    }),
    "移动力已用完",
  );
});

test("zero damage at every stance is not described as the best firing position", () => {
  const shape = { initiativeRounds: 1, kinds: 10, reachableTiles: 2, targets: 2 };
  const legal = new Uint8Array(40);
  for (const tile of [0, 1]) legal[actionFeasibilityIndex(shape, 0, actionKindIndex("standard_fire"), tile, 1)] = 1;
  const payload = { shape, stancePositions: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    feasibility: { shape, legal }, utility: new Float32Array(40), targetIds: [null, "target"],
    barrierVersion: 1, sustainedFireToken: 0, maxStandardActions: 1, locatedPathConditional: false } satisfies PlanningPayload;
  const reason = planStayReason({ payload, actions: [], slot: 0 });
  assert.equal(reason, "当前可选站位均无有效射击收益");
});
