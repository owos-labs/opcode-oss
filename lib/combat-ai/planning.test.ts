import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  setActionLegal,
} from "./action-feasibility.ts";
import {
  applySurrenderGate,
  buildScoredOptions,
  createPlanningBundle,
  mulberry32,
  prepareOptionsForSearch,
} from "./planning.ts";
import { selectDualMoveAndStandard } from "./search.ts";

test("mulberry32 is deterministic for a fixed seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("applySurrenderGate removes surrender when disabled", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const surrender = actionKindIndex("surrender");
  setActionLegal(feasibility, 0, surrender, 0, 0, true);
  utility[actionFeasibilityIndex(shape, 0, surrender, 0, 0)] = 100;

  const bundle = createPlanningBundle({
    profileId: "expert",
    feasibility,
    utility,
    randomSeed: 1,
    snapshotVersion: 1,
    allowNpcSurrender: false,
  });
  const options = buildScoredOptions(bundle);
  const gated = applySurrenderGate(bundle, options);
  assert.equal(gated.some(o => o.kindId === "surrender"), false);
});

test("prepareOptionsForSearch yields legal scored cells from tensor", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const move = actionKindIndex("move");
  setActionLegal(feasibility, 0, move, 0, 0, true);
  utility[actionFeasibilityIndex(shape, 0, move, 0, 0)] = 3;

  const bundle = createPlanningBundle({
    profileId: "newstupid",
    feasibility,
    utility,
    randomSeed: 99,
    snapshotVersion: 7,
  });
  const options = prepareOptionsForSearch(bundle);
  assert.equal(options.length, 1);
  assert.equal(options[0]!.kindId, "move");
  assert.equal(options[0]!.utility, 3);
});

test("located path marks fire as conditional timing, not an extra round", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const fire = actionKindIndex("standard_fire");
  setActionLegal(feasibility, 0, fire, 0, 0, true);
  utility[actionFeasibilityIndex(shape, 0, fire, 0, 0)] = 4;
  const bundle = createPlanningBundle({
    profileId: "professional",
    feasibility,
    utility,
    randomSeed: 1,
    snapshotVersion: 1,
    locatedPathConditional: true,
  });
  const options = prepareOptionsForSearch(bundle);
  assert.equal(options[0]!.timing, "conditional");
});

test("fire utility is not scaled by a lethality multiplier", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const fire = actionKindIndex("standard_fire");
  setActionLegal(feasibility, 0, fire, 0, 0, true);
  utility[actionFeasibilityIndex(shape, 0, fire, 0, 0)] = 10;
  const bundle = createPlanningBundle({
    profileId: "professional",
    feasibility,
    utility,
    randomSeed: 1,
    snapshotVersion: 1,
  });
  const options = buildScoredOptions(bundle);
  assert.equal(options[0]!.utility, 10);
});

test("a known movement track does not prevent moving out from behind a wall to fire", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 2, targets: 2 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  for (const tile of [0, 1]) {
    setActionLegal(feasibility, 0, actionKindIndex("move"), tile, 0, true);
    setActionLegal(feasibility, 0, actionKindIndex("standard_fire"), tile, 1, true);
    utility[actionFeasibilityIndex(shape, 0, actionKindIndex("standard_fire"), tile, 1)] = tile * 10;
  }
  const options = prepareOptionsForSearch(createPlanningBundle({ profileId: "professional", feasibility, utility,
    randomSeed: 42, snapshotVersion: 1, locatedPathConditional: true }));
  const actions = selectDualMoveAndStandard(options);
  assert.deepEqual(actions.map(a => [ACTION_KINDS[a.kind], a.tile, a.timing]), [
    ["move", 1, "immediate"], ["standard_fire", 1, "immediate"],
  ]);
});
