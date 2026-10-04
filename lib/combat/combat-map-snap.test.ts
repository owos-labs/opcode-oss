import assert from "node:assert/strict";
import test from "node:test";

import {
  collectCombatMapGridSnapTargets,
  collectCombatMapSnapTargets,
  mergeSnapTargets,
  meterGridSnapFromArtboard,
  snapDrawRectFromAnchor,
  snapMoveDelta,
  snapPoint,
  snapRectBounds,
  snapThresholdMapUnits,
  snapValueToGrid,
} from "./combat-map-snap.ts";
import { createDefaultCombatMapSvg, insertCombatMapRect } from "./combat-map-document.ts";

test("snapThresholdMapUnits scales screen threshold by zoom", () => {
  assert.equal(snapThresholdMapUnits(2), 4);
  assert.equal(snapThresholdMapUnits(0.5), 16);
});

test("collectCombatMapGridSnapTargets places lines every meter", () => {
  const targets = collectCombatMapGridSnapTargets({ x: 0, y: 0, w: 80, h: 40 }, 0.125);
  assert.deepEqual(targets.xs.slice(0, 4), [0, 8, 16, 24]);
  assert.deepEqual(targets.ys.slice(0, 3), [0, 8, 16]);
});

test("mergeSnapTargets deduplicates coordinates", () => {
  const merged = mergeSnapTargets(
    { xs: [0, 8], ys: [0] },
    { xs: [8, 16], ys: [0, 8] },
  );
  assert.deepEqual(merged.xs, [0, 8, 16]);
  assert.deepEqual(merged.ys, [0, 8]);
});

test("collectCombatMapSnapTargets includes artboard and element edges", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 100,
    y: 50,
    width: 40,
    height: 8,
  });
  svg = insertCombatMapRect(svg, {
    kind: "barrier",
    id: "wall-1",
    name: "wall-1",
    x: 140,
    y: 80,
    width: 20,
    height: 8,
  });
  const targets = collectCombatMapSnapTargets(svg, "wall-0");
  assert.ok(targets.xs.includes(140));
  assert.ok(targets.xs.includes(160));
  assert.ok(targets.ys.includes(80));
  assert.ok(targets.xs.includes(0));
  assert.ok(targets.xs.includes(1000));
});

test("snapRectBounds aligns nearby edges", () => {
  const targets = { xs: [100, 140], ys: [50, 58] };
  const snapped = snapRectBounds({ x: 103, y: 49, width: 40, height: 8 }, targets, 8);
  assert.equal(snapped.bounds.x, 100);
  assert.equal(snapped.bounds.y, 50);
  assert.deepEqual(snapped.guides, [
    { axis: "x", value: 100 },
    { axis: "y", value: 50 },
  ]);
});

test("snapMoveDelta returns snapped delta from origin bounds", () => {
  const origin = { x: 10, y: 20, width: 30, height: 10 };
  const targets = { xs: [50], ys: [40] };
  const moved = snapMoveDelta(origin, 39, 18, targets, 8);
  assert.equal(moved.dx, 40);
  assert.equal(moved.dy, 20);
});

test("snapValueToGrid snaps to nearest 1m line", () => {
  const snapped = snapValueToGrid(50.2, 0, 8, 4);
  assert.equal(snapped.value, 48);
  assert.equal(snapped.guide, 48);
});

test("snapPoint prefers meter grid when grid mode is on", () => {
  const grid = meterGridSnapFromArtboard({ x: 0, y: 0, w: 200, h: 200 }, 0.1);
  const snapped = snapPoint(52, 0, { xs: [100], ys: [] }, 5, grid);
  assert.equal(snapped.x, 50);
});

test("snapPoint and snapDrawRectFromAnchor snap active draw corners", () => {
  const targets = { xs: [100], ys: [200] };
  const point = snapPoint(103, 198, targets, 8);
  assert.equal(point.x, 100);
  assert.equal(point.y, 200);

  const draw = snapDrawRectFromAnchor({ x: 20, y: 20 }, { x: 103, y: 198 }, targets, 8);
  assert.equal(draw.bounds.x, 20);
  assert.equal(draw.bounds.y, 20);
  assert.equal(draw.bounds.width, 80);
  assert.equal(draw.bounds.height, 180);
});

test("snapDrawRectFromAnchor ignores meter grid so walls can be thinner than 0.5 m", () => {
  const grid = meterGridSnapFromArtboard({ x: 0, y: 0, w: 1000, h: 1000 }, 0.02);
  const gridSnapped = snapPoint(45, 0, { xs: [], ys: [] }, 16, grid);
  assert.equal(gridSnapped.x, 50);

  const draw = snapDrawRectFromAnchor({ x: 25, y: 0 }, { x: 28, y: 0 }, { xs: [], ys: [] }, 16);
  assert.equal(draw.bounds.width, 3);
  assert.equal(draw.corner.x, 28);
});
