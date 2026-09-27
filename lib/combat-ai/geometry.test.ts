import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localTacticalStances,
  orderedBarrierHits,
  visionBlockingSegments,
  type BallisticBarrier,
} from "./geometry.ts";

test("orderedBarrierHits returns hits sorted by t along the ray", () => {
  const observer = { x: 0, y: 0 };
  const target = { x: 10, y: 0 };
  const barriers: BallisticBarrier[] = [
    {
      id: "far",
      a: { x: 7, y: -1 },
      b: { x: 7, y: 1 },
      armorRating: 1,
      maxSsp: 10,
      currentSsp: 10,
      blocksVision: false,
    },
    {
      id: "near",
      a: { x: 3, y: -1 },
      b: { x: 3, y: 1 },
      armorRating: 2,
      maxSsp: 5,
      currentSsp: 5,
      blocksVision: true,
    },
  ];
  const hits = orderedBarrierHits(observer, target, barriers);
  assert.equal(hits.length, 2);
  assert.equal(hits[0]!.barrierId, "near");
  assert.equal(hits[1]!.barrierId, "far");
  assert.ok(hits[0]!.t < hits[1]!.t);
});

test("visionBlockingSegments keeps only blocksVision barriers", () => {
  const barriers: BallisticBarrier[] = [
    {
      id: "v",
      a: { x: 0, y: 0 },
      b: { x: 1, y: 0 },
      armorRating: 0,
      maxSsp: 0,
      currentSsp: 0,
      blocksVision: true,
    },
    {
      id: "ballistic-only",
      a: { x: 2, y: 0 },
      b: { x: 3, y: 0 },
      armorRating: 1,
      maxSsp: 1,
      currentSsp: 1,
      blocksVision: false,
    },
  ];
  const segs = visionBlockingSegments(barriers);
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0]!.a, barriers[0]!.a);
  assert.deepEqual(segs[0]!.b, barriers[0]!.b);
});

test("localTacticalStances includes positions within mov budget regardless of walls", () => {
  const origin = { x: 0, y: 0 };
  const walls = [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }];
  const stances = localTacticalStances({
    origin,
    movBudget: 5,
    cellSize: 1,
    walls,
    maxStances: 200,
  });
  assert.ok(stances.some((s) => s.position.x > 2 + 1e-6 && s.cost <= 5 + 1e-3));
  assert.ok(stances.every((s) => s.cost <= 5 + 1e-3));
});
