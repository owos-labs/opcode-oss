import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSuppressiveHitCount,
  rollAgilitySaveAgainstSuppress,
  suppressiveHitDieSides,
  suppressiveMarginHits,
} from "./suppressive-fire-resolution.ts";

test("suppressiveHitDieSides floors burst ammo over target count", () => {
  assert.equal(suppressiveHitDieSides(20, 1), 20);
  assert.equal(suppressiveHitDieSides(20, 2), 10);
});

test("suppressiveMarginHits is attack total minus hit difficulty", () => {
  assert.equal(suppressiveMarginHits(16, 15), 1);
});

test("resolveSuppressiveHitCount uses max of die roll and margin", () => {
  const raised = resolveSuppressiveHitCount({
    dieSides: 20,
    marginHits: 1,
    burstUnassigned: 10,
    rng: () => 0.99,
  });
  assert.equal(raised.dieRoll, 20);
  assert.equal(raised.hits, 10);

  const floor = resolveSuppressiveHitCount({
    dieSides: 10,
    marginHits: 4,
    burstUnassigned: 10,
    rng: () => 0,
  });
  assert.equal(floor.dieRoll, 1);
  assert.equal(floor.hits, 4);

  const noMargin = resolveSuppressiveHitCount({
    dieSides: 15,
    marginHits: 0,
    burstUnassigned: 30,
    rng: () => 0.99,
  });
  assert.equal(noMargin.dieRoll, 15);
  assert.equal(noMargin.hits, 0);
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
