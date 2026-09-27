import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  setActionLegal,
} from "./action-feasibility.ts";
import { decideRoundPlan } from "./decide.ts";

test("decideRoundPlan returns snapshot metadata and one action for newstupid", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 2, targets: 2 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  setActionLegal(feasibility, 0, move, 1, 0, true);
  setActionLegal(feasibility, 0, fire, 0, 1, true);
  utility[actionFeasibilityIndex(shape, 0, move, 1, 0)] = 1;
  utility[actionFeasibilityIndex(shape, 0, fire, 0, 1)] = 8;

  const plan = decideRoundPlan({
    profileId: "newstupid",
    feasibility,
    utility,
    randomSeed: 123,
    snapshotVersion: 42,
    startedAtMs: Date.now(),
    deadlineMs: 4800,
  });

  assert.equal(plan.snapshotVersion, 42);
  assert.equal(plan.randomSeed, 123);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]!.kind, fire);
  assert.equal(plan.timedOut, false);
});
