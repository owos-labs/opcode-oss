import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSuppressiveHitCount,
  rollAgilitySaveAgainstSuppress,
  suppressiveHitDieSides,
  suppressiveMarginHits,
} from "./suppressive-fire-resolution.ts";

test("suppressiveHitDieSides is remaining unassigned ammo", () => {
  assert.equal(suppressiveHitDieSides(20), 20);
  assert.equal(suppressiveHitDieSides(7), 7);
  assert.equal(suppressiveHitDieSides(0), 0);
});

test("suppressiveMarginHits is attack total minus hit difficulty", () => {
  assert.equal(suppressiveMarginHits(16, 15), 1);
  assert.equal(suppressiveMarginHits(19, 10), 9);
});

test("resolveSuppressiveHitCount is min of 1d(remaining) and success count", () => {
  const capped = resolveSuppressiveHitCount({
    ammoRemainingUnassigned: 30,
    successCount: 9,
    rng: () => 0.5,
  });
  assert.equal(capped.dieSides, 30);
  assert.equal(capped.dieRoll, 16);
  assert.equal(capped.hits, 9);

  const lowRoll = resolveSuppressiveHitCount({
    ammoRemainingUnassigned: 10,
    successCount: 4,
    rng: () => 0,
  });
  assert.equal(lowRoll.dieRoll, 1);
  assert.equal(lowRoll.hits, 1);

  const afterOtherHits = resolveSuppressiveHitCount({
    ammoRemainingUnassigned: 5,
    successCount: 1,
    rng: () => 0.99,
  });
  assert.equal(afterOtherHits.dieSides, 5);
  assert.equal(afterOtherHits.dieRoll, 5);
  assert.equal(afterOtherHits.hits, 1);

  const noSuccess = resolveSuppressiveHitCount({
    ammoRemainingUnassigned: 15,
    successCount: 0,
    rng: () => 0.99,
  });
  assert.equal(noSuccess.dieRoll, 15);
  assert.equal(noSuccess.hits, 0);
});

test("rollAgilitySaveAgainstSuppress uses REF and athletics", () => {
  const pass = rollAgilitySaveAgainstSuppress({
    ref: 6,
    athletics: 0,
    attackTotal: 16,
    rng: () => 0.95,
  });
  assert.equal(pass.total, 16);
  assert.equal(pass.success, true);
});
