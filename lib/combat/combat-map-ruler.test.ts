import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatMapGridLines,
  buildCombatMapGridLinesInRange,
  buildCombatMapGridPatternPath,
  buildCombatMapRulerMarks,
  buildCombatMapRulerMarksInRange,
  clipCombatMapGridLineSegment,
  combatMapGridStepSvg,
  formatRulerLabel,
  pickCombatMapGridStepMeters,
  pickRulerTickStepMeters,
  isMajorGridMeter,
} from "./combat-map-ruler.ts";

test("pickRulerTickStepMeters grows step when zoomed out", () => {
  const mpu = 0.125;
  assert.ok(pickRulerTickStepMeters(2, mpu) <= pickRulerTickStepMeters(0.5, mpu));
});

test("pickCombatMapGridStepMeters uses fixed zoom thresholds for sub-meter grid", () => {
  const mpu = 0.02;
  assert.equal(pickCombatMapGridStepMeters(5, mpu), 0.1);
  assert.equal(pickCombatMapGridStepMeters(4.9, mpu), 0.5);
  assert.equal(pickCombatMapGridStepMeters(3, mpu), 0.5);
  assert.equal(pickCombatMapGridStepMeters(2.9, mpu), 1);
  assert.equal(pickCombatMapGridStepMeters(0.5, mpu), 2);
});

test("isMajorGridMeter marks 1 m lines when minors are sub-meter", () => {
  assert.equal(isMajorGridMeter(1, 0.05), true);
  assert.equal(isMajorGridMeter(0.5, 0.05), false);
  assert.equal(isMajorGridMeter(10, 1), true);
  assert.equal(isMajorGridMeter(5, 1), false);
});

test("buildCombatMapGridLines uses 0.1 m spacing when requested", () => {
  const mpu = 0.02;
  const grid = buildCombatMapGridLines({ x: 0, y: 0, w: 100, h: 100 }, mpu, 0.1);
  const xs = grid.filter((line) => line.axis === "x").map((line) => line.svg);
  assert.equal(xs[0], 0);
  assert.equal(xs[1], 5);
  assert.equal(xs[2], 10);
  assert.ok(Math.abs(xs[3]! - 15) < 1e-9);
  assert.ok(grid.some((line) => line.axis === "x" && line.major && Math.abs(line.svg - 50) < 1e-9));
  assert.ok(grid.some((line) => line.axis === "x" && !line.major && Math.abs(line.svg - 5) < 1e-9));
});

test("buildCombatMapRulerMarks places labeled ticks along artboard edges", () => {
  const marks = buildCombatMapRulerMarks({ x: 0, y: 0, w: 800, h: 500 }, 0.125, 10);
  const topLabels = marks.filter((m) => m.axis === "x" && m.label !== null).map((m) => m.label);
  assert.deepEqual(topLabels.slice(0, 3), ["0m", "10m", "20m"]);
  assert.equal(formatRulerLabel(5), "5m");
  assert.ok(marks.some((m) => m.axis === "y" && m.label === "0m"));
  assert.ok(marks.some((m) => m.axis === "x" && !m.major));
});

test("buildCombatMapRulerMarksInRange filters to visible map extent", () => {
  const artboard = { x: 0, y: 0, w: 800, h: 500 };
  const all = buildCombatMapRulerMarks(artboard, 0.125, 10);
  const subset = buildCombatMapRulerMarksInRange(artboard, 0.125, 10, {
    minX: 70,
    maxX: 130,
    minY: 0,
    maxY: 500,
  });
  assert.ok(subset.length < all.length);
  assert.ok(subset.every((m) => m.axis !== "x" || (m.svg >= 70 && m.svg <= 130)));
});

test("buildCombatMapGridLines uses 1m spacing with 10m major lines", () => {
  const mpu = 0.125;
  const grid = buildCombatMapGridLines({ x: 0, y: 0, w: 80, h: 40 }, mpu);
  const xs = grid.filter((line) => line.axis === "x").map((line) => line.svg);
  assert.deepEqual(xs.slice(0, 4), [0, 8, 16, 24]);
  assert.ok(grid.some((line) => line.axis === "x" && line.major && line.svg === 80));
  assert.ok(grid.some((line) => line.axis === "x" && !line.major && line.svg === 8));
});

test("buildCombatMapGridLinesInRange keeps only lines crossing the viewport", () => {
  const artboard = { x: 0, y: 0, w: 80, h: 40 };
  const mpu = 0.125;
  const all = buildCombatMapGridLines(artboard, mpu);
  const subset = buildCombatMapGridLinesInRange(artboard, mpu, {
    minX: 7,
    maxX: 17,
    minY: 0,
    maxY: 40,
  });
  assert.ok(subset.length < all.length);
  assert.ok(subset.every((line) => line.axis !== "x" || (line.svg >= 7 && line.svg <= 17)));
});

test("clipCombatMapGridLineSegment trims to artboard and visible range", () => {
  const artboard = { x: 0, y: 0, w: 100, h: 100 };
  const range = { minX: 10, maxX: 90, minY: 20, maxY: 80 };
  assert.deepEqual(
    clipCombatMapGridLineSegment({ axis: "x", svg: 50, major: false }, artboard, range),
    { x1: 50, y1: 20, x2: 50, y2: 80 },
  );
  assert.deepEqual(
    clipCombatMapGridLineSegment({ axis: "y", svg: 5, major: false }, artboard, range),
    { x1: 10, y1: 5, x2: 90, y2: 5 },
  );
});

test("buildCombatMapGridPatternPath tiles 1m minors inside 10m major cell", () => {
  const minor = combatMapGridStepSvg(0.125);
  const major = 10 / 0.125;
  assert.equal(minor, 8);
  assert.equal(major, 80);
  const path = buildCombatMapGridPatternPath(minor, major);
  assert.match(path, /M 8 0 V 80/);
  assert.match(path, /M 80 0 L 0 0 0 80/);
});
