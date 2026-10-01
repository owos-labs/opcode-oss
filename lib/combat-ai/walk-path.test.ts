import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bakeWalkWalls,
  expandVisibilityWalk,
  expandWalkCosts,
  hasWalkClear,
  stepAlongWalk,
  walkPath,
  walkPathPoints,
  walkPathMeters,
  walkCostViaNodes,
  walkStepPositions,
  walkWalls,
  unionWalkRings,
} from "./walk-path.ts";

test("walkPathMeters is straight-line when LOS is clear", () => {
  assert.equal(walkPathMeters({ x: 0, y: 0 }, { x: 3, y: 4 }, []), 5);
  assert.equal(walkPathMeters({ x: 1, y: 1 }, { x: 1, y: 1 }, []), 0);
});

test("walkPathMeters cannot cross a long wall inside a short budget", () => {
  const wall = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  assert.equal(walkPathMeters({ x: 0, y: 0 }, { x: 4, y: 0 }, wall, { maxMeters: 8 }), null);
  assert.equal(walkPathMeters({ x: 0, y: 0 }, { x: 1, y: 0 }, wall, { maxMeters: 8 }), 1);
});

test("walkPathMeters goes around a short wall and costs more than Euclidean", () => {
  const wall = [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }];
  const around = walkPathMeters({ x: 0, y: 0 }, { x: 4, y: 0 }, wall, { maxMeters: 12 });
  assert.ok(around != null);
  assert.ok(around > 4 + 1e-3);
  assert.ok(around <= 12);
});

test("walkPathMeters can walk along a wall without treating it as a crossing", () => {
  const wall = [{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }];
  assert.equal(walkPathMeters({ x: 1, y: 0 }, { x: 8, y: 0 }, wall, { maxMeters: 10 }), 7);
});

test("expandWalkCosts does not step onto a wall to slip through", () => {
  const wall = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  const nodes = expandWalkCosts({ x: 0, y: 0 }, wall, 12, 1);
  assert.equal(nodes.some((n) => n.pos.x > 2 + 1e-6), false);
});

test("expandVisibilityWalk goes around a short wall via inset corners", () => {
  const wall = [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }];
  const nodes = expandVisibilityWalk({ x: 0, y: 0 }, wall, 12);
  assert.ok(nodes.some((n) => n.pos.x > 2 && n.cost <= 12));
  const around = walkPathMeters({ x: 0, y: 0 }, { x: 4, y: 0 }, wall, { maxMeters: 12 });
  assert.ok(around != null);
  assert.ok(around! > 4 + 1e-3);
  assert.ok(around! <= 12);
});

function sealedBox(): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  return [
    { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
    { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
    { a: { x: 10, y: 10 }, b: { x: 0, y: 10 } },
    { a: { x: 0, y: 10 }, b: { x: 0, y: 0 } },
  ];
}

test("walkPathMeters cannot leave or enter a sealed box", () => {
  const box = sealedBox();
  assert.equal(walkPathMeters({ x: 5, y: 5 }, { x: 15, y: 5 }, box, { maxMeters: 40 }), null);
  assert.equal(walkPathMeters({ x: 15, y: 5 }, { x: 5, y: 5 }, box, { maxMeters: 40 }), null);
});

test("a cover candidate on a wall edge cannot become a landing or a bridge into the wall", () => {
  const walls = sealedBox();
  const from = { x: 5, y: -2 };
  const edge = { x: 5, y: 0 };
  assert.equal(hasWalkClear(from, edge, walls), false);
  assert.equal(walkPath(from, edge, walls), null);
  assert.equal(walkCostViaNodes(from, edge, expandVisibilityWalk(from, walls, 10), walls, 10), null);
  assert.deepEqual(stepAlongWalk(from, edge, walls, 10), from);
  for (const node of expandWalkCosts(from, walls, 2)) {
    assert.ok(walkPath(from, node.pos, walls), `unreachable sample ${JSON.stringify(node.pos)}`);
  }
});

function insideOpenBox(p: { x: number; y: number }): boolean {
  return p.x > 0.05 && p.x < 9.95 && p.y > 0.05 && p.y < 9.95;
}

test("stepAlongWalk stays inside a sealed box when the dest is outside", () => {
  const box = sealedBox();
  const p = stepAlongWalk({ x: 5, y: 5 }, { x: 20, y: 5 }, box, 8);
  assert.ok(insideOpenBox(p));
});

test("walkWalls map frame seals a pocket at the bound corner", () => {
  const walls = [{ a: { x: 8, y: 8 }, b: { x: 8, y: 16 } }, { a: { x: 8, y: 8 }, b: { x: 16, y: 8 } }];
  const bounds = { min: { x: 0, y: 0 }, max: { x: 16, y: 16 } };
  const boxed = walkWalls(walls, bounds);
  assert.equal(walkPathMeters({ x: 12, y: 12 }, { x: 4, y: 4 }, boxed, { maxMeters: 40 }), null);
});

test("stepAlongWalk outside a sealed box does not step inside", () => {
  const box = sealedBox();
  const p = stepAlongWalk({ x: 15, y: 5 }, { x: 5, y: 5 }, box, 8);
  assert.equal(insideOpenBox(p), false);
});

test("bakeWalkWalls merges overlapping collinear walls into one", () => {
  const baked = bakeWalkWalls([
    { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } },
    { a: { x: 2, y: 0 }, b: { x: 6, y: 0 } },
    { a: { x: 6, y: 0 }, b: { x: 0, y: 0 } },
  ]);
  assert.equal(baked.length, 1);
  const xs = [baked[0]!.a.x, baked[0]!.b.x].sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0]!) < 1e-6);
  assert.ok(Math.abs(xs[1]! - 6) < 1e-6);
});

test("bakeWalkWalls keeps a gap and parallel offset walls", () => {
  const baked = bakeWalkWalls([
    { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
    { a: { x: 3, y: 0 }, b: { x: 5, y: 0 } },
    { a: { x: 0, y: 1 }, b: { x: 5, y: 1 } },
  ]);
  assert.equal(baked.length, 3);
});

test("unionWalkRings drops internal edges of overlapping rects", () => {
  const a = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];
  const b = [
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 },
    { x: 1, y: 2 },
  ];
  const walls = unionWalkRings([a, b]);
  assert.equal(walls.length, 4);
  assert.equal(walkPathMeters({ x: 0.5, y: 1 }, { x: 2.5, y: 1 }, walls, { maxMeters: 4 }), 2);
  assert.equal(walkPathMeters({ x: -0.5, y: 1 }, { x: 3.5, y: 1 }, walls, { maxMeters: 4 }), null);
});

test("unionWalkRings keeps nested inner walls out of the outline", () => {
  const outer = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ];
  const inner = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ];
  const walls = unionWalkRings([outer, inner]);
  assert.equal(walls.length, 4);
  assert.equal(walkPathMeters({ x: 1.5, y: 1.5 }, { x: 1.5, y: 0.5 }, walls, { maxMeters: 4 }), 1);
});

test("walkStepPositions lands on the walked path around a wall, not the Euclidean chord", () => {
  const wall = [{ a: { x: 2, y: -2 }, b: { x: 2, y: 2 } }];
  const steps = walkStepPositions({ x: 0, y: 0 }, { x: 4, y: 0 }, wall, 1.5);
  assert.ok(steps.length >= 3);
  assert.equal(steps[0]!.x, 0);
  const mid = steps[1]!;
  assert.ok(Math.abs(mid.y) > 0.1, `expected a corner hop, got ${mid.x},${mid.y}`);
  assert.ok(mid.x < 3.9);
});

test("walk samples next to a wall are reachable within their reported cost", () => {
  const origin = { x: 1.9, y: 0 };
  const walls = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  for (const node of expandWalkCosts(origin, walls, 5)) {
    const cost = walkPathMeters(origin, node.pos, walls, { maxMeters: node.cost + 1e-6 });
    assert.ok(cost !== null, `unreachable sample ${JSON.stringify(node)}`);
  }
});

test("long detours use a complete route and make progress over multiple turns", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 4, y: 0 };
  const walls = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  const route = walkPath(from, to, walls);
  assert.ok(route, "a route exists around either end of the wall");
  assert.ok(route.meters > 40);
  assert.equal(walkPath(from, to, walls, 8), null, "the full route exceeds this turn's budget");
  assert.deepEqual(walkPathPoints(from, to, walls), route.points);
  const positions = walkStepPositions(from, to, walls, 5);
  assert.deepEqual(positions.at(-1), to, "preview follows the complete route");

  let current = from;
  for (let turn = 0; turn < 12 && Math.hypot(current.x - to.x, current.y - to.y) > 1e-6; turn++) {
    const next = stepAlongWalk(current, to, walls, 5);
    assert.ok(walkPathMeters(current, next, walls, { maxMeters: 5 + 1e-6 }) !== null);
    assert.ok(Math.hypot(next.x - current.x, next.y - current.y) > 1e-6, "must not stall at the wall");
    current = next;
  }
  assert.ok(Math.hypot(current.x - to.x, current.y - to.y) < 1e-6);
});

test("leaving a deep U-shaped pocket can initially move away from the destination", () => {
  const from = { x: 5, y: 25 };
  const to = { x: 5, y: 35 };
  const walls = [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 30 } },
    { a: { x: 0, y: 30 }, b: { x: 10, y: 30 } },
    { a: { x: 10, y: 30 }, b: { x: 10, y: 0 } },
  ];
  const next = stepAlongWalk(from, to, walls, 5);
  assert.ok(next.y < from.y, "the exit is behind the actor");
  const route = walkPath(from, to, walls);
  assert.ok(route);
  for (let i = 1; i < route.points.length; i++) {
    assert.ok(hasWalkClear(route.points[i - 1]!, route.points[i]!, walls));
  }
});

test("unreachable destinations report no route and do not invent an approach path", () => {
  const from = { x: 5, y: 5 };
  const to = { x: 15, y: 5 };
  const walls = sealedBox();
  assert.equal(walkPath(from, to, walls), null);
  assert.deepEqual(stepAlongWalk(from, to, walls, 8), from);
  assert.deepEqual(walkPathPoints(from, to, walls), [from]);
  assert.deepEqual(walkStepPositions(from, to, walls, 8), [from]);
});

test("cached geometry keeps route results independent of query budgets and map changes", () => {
  const from = { x: 5, y: 5 };
  const to = { x: 15, y: 5 };
  const open = sealedBox().slice(0, 3);
  const first = walkPath(from, to, open);
  assert.ok(first);
  assert.equal(walkPath(from, to, open, 10), null);
  assert.deepEqual(walkPath(from, to, open), first);
  assert.equal(walkPath(from, to, sealedBox()), null);
  assert.deepEqual(walkPath(from, to, open), first);
});

test("walk-wall reuse respects changed map boundaries", () => {
  const walls = [{ a: { x: 8, y: 8 }, b: { x: 8, y: 16 } }, { a: { x: 8, y: 8 }, b: { x: 16, y: 8 } }];
  const from = { x: 12, y: 12 };
  const to = { x: 4, y: 4 };
  const small = walkWalls(walls, { min: { x: 0, y: 0 }, max: { x: 16, y: 16 } });
  assert.equal(walkPath(from, to, small), null);
  const expanded = walkWalls(walls, { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } });
  assert.ok(walkPath(from, to, expanded));
  assert.equal(walkPath(from, to, small), null);
});
