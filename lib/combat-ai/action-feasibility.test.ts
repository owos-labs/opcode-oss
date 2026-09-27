import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionFeasibilitySize,
  actionKindIndex,
  countLegalActions,
  createActionFeasibilityTensor,
  isActionLegal,
  iterateLegalActions,
  setActionLegal,
} from "./action-feasibility.ts";

test("actionFeasibilityIndex is row-major round × kind × tile × target", () => {
  const shape = { initiativeRounds: 2, kinds: 3, reachableTiles: 2, targets: 2 };
  assert.equal(actionFeasibilitySize(shape), 2 * 3 * 2 * 2);
  assert.equal(actionFeasibilityIndex(shape, 0, 0, 0, 0), 0);
  assert.equal(actionFeasibilityIndex(shape, 0, 0, 0, 1), 1);
  assert.equal(actionFeasibilityIndex(shape, 0, 0, 1, 0), 2);
  assert.equal(actionFeasibilityIndex(shape, 1, 0, 0, 0), 12);
});

test("iterateLegalActions only yields set bits", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 2, targets: 2 };
  const tensor = createActionFeasibilityTensor(shape);
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  setActionLegal(tensor, 0, move, 1, 0, true);
  setActionLegal(tensor, 0, fire, 0, 1, true);
  assert.equal(countLegalActions(tensor), 2);
  assert.deepEqual([...iterateLegalActions(tensor)], [
    { round: 0, kind: move, tile: 1, target: 0 },
    { round: 0, kind: fire, tile: 0, target: 1 },
  ]);
  assert.equal(isActionLegal(tensor, 0, move, 1, 0), true);
  assert.equal(isActionLegal(tensor, 0, move, 0, 0), false);
});
