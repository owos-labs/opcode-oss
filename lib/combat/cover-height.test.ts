import assert from "node:assert/strict";
import { test } from "node:test";

import {
  coverHeightBandFromFraction,
  coverHeightHitDifficultyAdd,
} from "./cover-height.ts";

test("coverHeightBandFromFraction matches map.impl.py table", () => {
  assert.equal(coverHeightBandFromFraction(1), "full");
  assert.equal(coverHeightBandFromFraction(0.75), "two_thirds");
  assert.equal(coverHeightBandFromFraction(0.5), "half");
  assert.equal(coverHeightBandFromFraction(0.2), "leg");
});

test("coverHeightHitDifficultyAdd follows 1.7 cover table where defined", () => {
  assert.equal(coverHeightHitDifficultyAdd("third"), 2);
  assert.equal(coverHeightHitDifficultyAdd("half"), 3);
  assert.equal(coverHeightHitDifficultyAdd("full"), 5);
});
