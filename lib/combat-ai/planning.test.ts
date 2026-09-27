import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  setActionLegal,
} from "./action-feasibility.ts";
import { getNpcDifficultyProfile } from "./difficulty.ts";
import {
  applySuppressionGate,
  applySurrenderGate,
  buildScoredOptions,
  createPlanningBundle,
  drawBehaviorGates,
  mulberry32,
  prepareOptionsForSearch,
} from "./planning.ts";

test("mulberry32 is deterministic for a fixed seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("applySuppressionGate drops suppressive_fire when gate fails and it beats alternatives", () => {
  const profile = getNpcDifficultyProfile("trained");
  const suppress = actionKindIndex("suppressive_fire");
  const fire = actionKindIndex("standard_fire");
  const options = [
    {
      round: 0,
      kind: suppress,
      tile: 0,
      target: 1,
      kindId: "suppressive_fire" as const,
      utility: 10,
      utilityUpperBound: 10,
      timing: "immediate" as const,
    },
    {
      round: 0,
      kind: fire,
      tile: 0,
      target: 1,
      kindId: "standard_fire" as const,
      utility: 5,
      utilityUpperBound: 5,
      timing: "immediate" as const,
    },
  ];
  const filtered = applySuppressionGate(profile, options, 1);
  assert.ok(filtered.every(o => o.kind !== suppress));
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
  const draws = drawBehaviorGates(bundle.randomSeed);
  const options = buildScoredOptions(bundle, draws);
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
