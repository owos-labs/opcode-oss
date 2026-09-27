import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveBallisticToTarget } from "./ballistic.ts";

test("resolveBallisticToTarget stops when penetration below AR", () => {
  const result = resolveBallisticToTarget(30, 4, [
    { barrierId: "w", t: 0.5, armorRating: 40, currentSsp: 20 },
  ]);
  assert.equal(result.reachesTarget, false);
  assert.equal(result.expectedDamageDice, 0);
});

test("resolveBallisticToTarget penetrates and reduces expected dice", () => {
  const result = resolveBallisticToTarget(55, 4, [
    { barrierId: "c", t: 0.4, armorRating: 45, currentSsp: 30 },
  ]);
  assert.equal(result.reachesTarget, true);
  assert.equal(result.remainingPenetration, 10);
  assert.equal(result.expectedDamageDice, 3);
  assert.ok((result.sspDeductionByBarrierId.c ?? 0) >= 1);
});
