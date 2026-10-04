import assert from "node:assert/strict";
import test from "node:test";

import { meterPolylineSvgPoints, metersToSvgPoint } from "./combat-map-meter-svg.ts";

const viewBox = { x: 0, y: 0, w: 100, h: 50 };

test("metersToSvgPoint maps meter coords into svg user space", () => {
  const pt = metersToSvgPoint(10, 5, viewBox, 0.1);
  assert.equal(pt.x, 100);
  assert.equal(pt.y, 50);
});

test("meterPolylineSvgPoints joins converted vertices", () => {
  const points = meterPolylineSvgPoints(
    [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ],
    viewBox,
    0.1,
  );
  assert.equal(points, "0,0 100,50");
});
