import assert from "node:assert/strict";
import { test } from "node:test";

import { maxRoundMovementMeters, remainingMoveBudgetMeters, stepToward } from "./movement.ts";

test("round move budget is 1x MOV", () => {
  assert.equal(maxRoundMovementMeters(10), 10);
  assert.equal(remainingMoveBudgetMeters(10, 4), 6);
});

test("stepToward returns the destination when it is inside the budget", () => {
  assert.deepEqual(stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 10), { x: 3, y: 4 });
});

test("stepToward clips to budget along the line", () => {
  const p = stepToward({ x: 0, y: 0 }, { x: 8, y: 0 }, 2);
  assert.equal(p.x, 2);
  assert.equal(p.y, 0);
});
