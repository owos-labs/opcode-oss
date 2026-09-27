import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeInformationBoundary,
  filterIdsByBoundary,
  hasLineOfSight,
  segmentsIntersect,
  visibleTargetIds,
} from "./visibility.ts";

test("segmentsIntersect detects crossing walls", () => {
  assert.equal(
    segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }),
    true,
  );
  assert.equal(
    segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }),
    false,
  );
});

test("hasLineOfSight is clear when no walls", () => {
  assert.equal(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, []), true);
});

test("hasLineOfSight is blocked by a wall between observer and target", () => {
  const walls = [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }];
  assert.equal(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, walls), false);
  assert.equal(hasLineOfSight({ x: 0, y: 0 }, { x: 1.5, y: 0 }, walls), true);
});

test("visibleTargetIds returns only unobstructed targets", () => {
  const observer = { x: 0, y: 0 };
  const targets = [
    { id: "a", position: { x: 3, y: 0 } },
    { id: "b", position: { x: 6, y: 0 } },
  ];
  const walls = [{ a: { x: 4, y: -1 }, b: { x: 4, y: 1 } }];
  assert.deepEqual(visibleTargetIds(observer, targets, walls), ["a"]);
});

test("computeInformationBoundary and filterIdsByBoundary share one id list", () => {
  const boundary = computeInformationBoundary(
    { x: 0, y: 0 },
    [
      { id: "near", position: { x: 2, y: 0 } },
      { id: "far", position: { x: 8, y: 0 } },
    ],
    [{ a: { x: 5, y: -2 }, b: { x: 5, y: 2 } }],
  );
  assert.deepEqual(boundary.visibleIds, ["near"]);
  const units = [
    { id: "near", hp: 10 },
    { id: "far", hp: 3 },
  ];
  assert.deepEqual(filterIdsByBoundary(units, boundary), [{ id: "near", hp: 10 }]);
});
