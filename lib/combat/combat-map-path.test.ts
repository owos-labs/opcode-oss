import assert from "node:assert/strict";
import test from "node:test";

import { formatPathD, parsePathD, setPathVertex, translatePathD } from "./combat-map-path.ts";

const SAMPLE = "M250 547L250 394L353.5 247L368 255.5L271 394L271 547L250 547Z";

test("parsePathD reads M/L combat paths", () => {
  const pts = parsePathD(SAMPLE);
  assert.equal(pts.length, 7);
  assert.equal(pts[0]!.x, 250);
  assert.equal(pts[2]!.y, 247);
});

test("translatePathD shifts every vertex", () => {
  const next = translatePathD(SAMPLE, 10, -5);
  assert.equal(parsePathD(next)[0]!.x, 260);
  assert.equal(parsePathD(next)[0]!.y, 542);
  assert.match(next, /Z$/);
});

test("setPathVertex updates one point and keeps closure", () => {
  const next = setPathVertex(SAMPLE, 2, 400, 300);
  assert.equal(parsePathD(next)[2]!.x, 400);
  assert.match(next, /Z$/);
});

test("formatPathD round-trips simple polyline", () => {
  const d = formatPathD([
    { x: 1.23, y: 4.56 },
    { x: 7.89, y: 0.1 },
  ]);
  assert.equal(d, "M1.2 4.6L7.9 0.1");
});
