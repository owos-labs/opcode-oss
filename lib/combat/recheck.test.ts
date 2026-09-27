import assert from "node:assert/strict";
import { test } from "node:test";

import { runCombatCheck, runCombatCheckAfterBarrierBump } from "./run-check.ts";
import { defaultCombatSnapshot, loadSimpleMapFixture } from "./scenario-fixture.ts";

test("recheck passes for unchanged snapshot", () => {
  const report = runCombatCheck({
    snapshot: defaultCombatSnapshot(),
    map: loadSimpleMapFixture(),
    randomSeed: 7,
  });
  assert.equal(report.recheckOk, true);
  assert.ok(report.plan.actions.length > 0);
});

test("barrierVersion bump fails version recheck", () => {
  const { before, afterVersionRecheck } = runCombatCheckAfterBarrierBump(
    {
      snapshot: defaultCombatSnapshot(),
      map: loadSimpleMapFixture(),
      randomSeed: 7,
    },
    { barrierVersion: 2 },
  );
  assert.equal(before.recheckOk, true);
  assert.equal(afterVersionRecheck.ok, false);
  assert.equal(afterVersionRecheck.reason, "barrier_version");
});

test("sustainedFire token bump fails version recheck", () => {
  const { afterVersionRecheck } = runCombatCheckAfterBarrierBump(
    {
      snapshot: defaultCombatSnapshot(),
      map: loadSimpleMapFixture(),
    },
    {
      sustainedFire: { active: true, walkFireMalus: 1, token: 1 },
    },
  );
  assert.equal(afterVersionRecheck.ok, false);
  assert.equal(afterVersionRecheck.reason, "sustained_fire_token");
});
