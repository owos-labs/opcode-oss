import assert from "node:assert/strict";
import test from "node:test";

import {
  clampMoveDeltaForBounds,
  clampPathMoveDelta,
  clampRectToArtboard,
  intersectRectWithArtboard,
} from "./combat-map-bounds-clamp.ts";

const board = { x: 0, y: 0, w: 800, h: 500 };

test("clampRectToArtboard keeps rect inside artboard", () => {
  const next = clampRectToArtboard({ x: -439, y: 704, width: 111, height: 110 }, board);
  assert.equal(next.x, 0);
  assert.equal(next.y, 390);
  assert.equal(next.width, 111);
  assert.equal(next.height, 110);
});

test("intersectRectWithArtboard clips draw preview to artboard", () => {
  const hit = intersectRectWithArtboard(-10, 20, 100, 80, board);
  assert.deepEqual(hit, { x: 0, y: 20, width: 90, height: 80 });
});

test("clampMoveDeltaForBounds stops drag at artboard edge", () => {
  const { dx, dy } = clampMoveDeltaForBounds({ x: 790, y: 10, width: 20, height: 10 }, 20, 0, board);
  assert.equal(dx, -10);
  assert.equal(dy, 0);
});

test("clampPathMoveDelta keeps translated path inside artboard", () => {
  const { dx, dy } = clampPathMoveDelta("M0 0L50 0L50 50Z", -20, 0, board);
  assert.equal(dx, 0);
  assert.equal(dy, 0);
});
