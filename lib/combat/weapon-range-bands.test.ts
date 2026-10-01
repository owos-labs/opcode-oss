import assert from "node:assert/strict";
import test from "node:test";

import { weaponRangeBandRadii } from "./weapon-range-bands.ts";

test("weaponRangeBandRadii is empty without a positive range", () => {
  assert.deepEqual(weaponRangeBandRadii(0), []);
  assert.deepEqual(weaponRangeBandRadii(-4), []);
});

test("weaponRangeBandRadii uses 2.5 m point-blank and 0.5/1/2× weapon range", () => {
  const bands = weaponRangeBandRadii(20);
  assert.equal(bands.length, 4);
  assert.equal(bands[0]!.id, "pointBlank");
  assert.equal(bands[0]!.radiusM, 2.5);
  assert.equal(bands[1]!.radiusM, 10);
  assert.equal(bands[2]!.radiusM, 20);
  assert.equal(bands[3]!.radiusM, 40);
});
