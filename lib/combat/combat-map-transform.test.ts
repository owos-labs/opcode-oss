import assert from "node:assert/strict";
import test from "node:test";

import {
  boundsFromPoints,
  formatRectRotation,
  parseRectRotation,
  pointerAngleDeg,
  rectWorldCorners,
  snapRotationDegrees,
} from "./combat-map-transform.ts";

test("parseRectRotation reads rotate(cx cy) transform", () => {
  assert.deepEqual(parseRectRotation("rotate(90 50 60)"), { deg: 90, cx: 50, cy: 60 });
  assert.equal(parseRectRotation(""), null);
});

test("formatRectRotation omits near-zero angles", () => {
  assert.equal(formatRectRotation({ deg: 0, cx: 1, cy: 2 }), "");
  assert.equal(formatRectRotation({ deg: 45, cx: 1, cy: 2 }), "rotate(45 1 2)");
});

test("rectWorldCorners rotates local rect about pivot", () => {
  const bounds = { x: 0, y: 0, width: 10, height: 20 };
  const corners = rectWorldCorners(bounds, { deg: 90, cx: 0, cy: 0 });
  assert.deepEqual(corners[0], { x: 0, y: 0 });
  assert.ok(Math.abs(corners[1]!.x) < 1e-9);
  assert.equal(corners[1]!.y, 10);
});

test("boundsFromPoints wraps rotated rect", () => {
  const bounds = { x: 0, y: 0, width: 10, height: 20 };
  const aabb = boundsFromPoints(rectWorldCorners(bounds, { deg: 90, cx: 5, cy: 10 }));
  assert.equal(aabb.width, 20);
  assert.equal(aabb.height, 10);
});

test("pointerAngleDeg and snapRotationDegrees", () => {
  assert.equal(pointerAngleDeg(0, 0, 1, 0), 0);
  assert.equal(snapRotationDegrees(44), 45);
  assert.equal(snapRotationDegrees(88), 90);
  assert.equal(snapRotationDegrees(52), 45);
  assert.equal(snapRotationDegrees(-46), -45);
});
