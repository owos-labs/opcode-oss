import assert from "node:assert/strict";
import { test } from "node:test";

import { combatBallisticHits, resolveBallisticToTarget } from "./ballistic.ts";
import type { BallisticBarrier } from "../combat-ai/geometry.ts";

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

test("combatBallisticHits ignores concealment and collapses crate edges to one layer", () => {
  const barriers: BallisticBarrier[] = [
    {
      id: "crate-e0",
      a: { x: 3, y: -2 },
      b: { x: 3, y: 2 },
      armorRating: 15,
      maxSsp: 10,
      currentSsp: 10,
      blocksVision: true,
    },
    {
      id: "crate-e2",
      a: { x: 5, y: -2 },
      b: { x: 5, y: 2 },
      armorRating: 15,
      maxSsp: 10,
      currentSsp: 10,
      blocksVision: true,
    },
    {
      id: "bush-e0",
      a: { x: 2, y: -2 },
      b: { x: 2, y: 2 },
      armorRating: 15,
      maxSsp: 10,
      currentSsp: 10,
      blocksVision: false,
    },
  ];
  const hits = combatBallisticHits({ x: 0, y: 0 }, { x: 10, y: 0 }, barriers);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.barrierId, "crate");
});
