import assert from "node:assert/strict";
import { test } from "node:test";

import { coverHeightSelectOptions, normalizeCoverHeightFraction } from "./cover-height-options.ts";
import { coverHeightBandFromFraction } from "./cover-height.ts";

test("normalizeCoverHeightFraction maps stored values to editor options", () => {
  assert.equal(normalizeCoverHeightFraction("1"), "1");
  assert.equal(normalizeCoverHeightFraction("0.75"), "0.75");
  assert.equal(normalizeCoverHeightFraction("0.5"), "0.5");
  assert.equal(normalizeCoverHeightFraction("0.333"), "0.333");
  assert.equal(normalizeCoverHeightFraction(undefined), "0.75");
  assert.equal(normalizeCoverHeightFraction("0.2"), "0.333");
});

test("coverHeightBandFromFraction maps 1/3 fraction to third band", () => {
  assert.equal(coverHeightBandFromFraction(0.333), "third");
  assert.equal(coverHeightBandFromFraction(0.2), "leg");
});

test("coverHeightSelectOptions uses i18n keys for labels", () => {
  const labels = Object.fromEntries(
    coverHeightSelectOptions((key) => key).map((option) => [option.value, option.label]),
  );
  assert.equal(labels["0.333"], "combat.editor.coverHeight.third");
  assert.equal(labels["0.75"], "combat.editor.coverHeight.twoThirds");
});
