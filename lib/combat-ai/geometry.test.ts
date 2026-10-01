import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localTacticalStances,
  orderedBarrierHits,
  rayCoverHitT,
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

test("rayCoverHitT returns interior hit t on a crossing segment", () => {
  const t = rayCoverHitT({ x: 0, y: 0 }, { x: 10, y: 0 }, { a: { x: 5, y: -1 }, b: { x: 5, y: 1 } });
  assert.ok(t !== null);
  assert.ok(t! > 0 && t! < 1);
});

test("localTacticalStances prices cells by walked path, not Euclidean through walls", () => {
  const origin = { x: 0, y: 0 };
  const wall = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  const blocked = localTacticalStances({
    origin,
    movBudget: 6,
    cellSize: 1,
    walls: wall,
    maxStances: 200,
  });
  assert.equal(
    blocked.some((s) => s.position.x > 2 + 1e-6 && s.cost <= 6 + 1e-3),
    false,
  );
  const open = localTacticalStances({
    origin,
    movBudget: 6,
    cellSize: 1,
    walls: [],
    maxStances: 200,
  });
  assert.ok(open.some((s) => s.position.x > 2 + 1e-6 && s.cost <= 6 + 1e-3));
  assert.ok(open.every((s) => s.cost <= 6 + 1e-3));
  const around = localTacticalStances({
    origin,
    movBudget: 12,
    cellSize: 1,
    walls: [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }],
    maxStances: 200,
  });
  assert.ok(around.some((s) => s.position.x > 2 + 1e-6 && s.cost <= 12 + 1e-3));
});

test("localTacticalStances spreads candidates across the walk budget", () => {
  const origin = { x: 3, y: 2 };
  const stances = localTacticalStances({
    origin,
    movBudget: 21,
    cellSize: 1,
    walls: [],
    maxStances: 15,
    inBounds: (p) => p.x >= 0 && p.y >= 0,
  });
  assert.ok(stances.length > 0);
  assert.ok(stances.every((s) => s.position.x >= 0 && s.position.y >= 0));
  assert.ok(stances.some((s) => s.cost > 8));
  assert.ok(stances.some((s) => s.cost <= 2));
});
