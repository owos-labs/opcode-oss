import assert from "node:assert/strict";
import { test } from "node:test";

import {
  initiativeCostOfStandardAction,
  maxStandardActionsInRound,
  unifiedStandardActionMalus,
} from "./initiative.ts";

test("initiative costs follow 3/6/9 increments", () => {
  assert.equal(initiativeCostOfStandardAction(0), 3);
  assert.equal(initiativeCostOfStandardAction(1), 6);
  assert.equal(maxStandardActionsInRound(21), 3);
  assert.equal(maxStandardActionsInRound(8), 1);
});

test("unified malus escalates with action count", () => {
  assert.equal(unifiedStandardActionMalus(1), 0);
  assert.equal(unifiedStandardActionMalus(2), -3);
  assert.equal(unifiedStandardActionMalus(3), -6);
});
