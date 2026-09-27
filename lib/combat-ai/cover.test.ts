import assert from "node:assert/strict";
import { test } from "node:test";

import { canDealDamageThroughCover, resolveCoverEngagement, totalCoverThicknessOnRay } from "./cover.ts";
import { getNpcDifficultyProfile } from "./difficulty.ts";

const observer = { x: 0, y: 0 };
const target = { x: 10, y: 0 };
const thinCover = [{ a: { x: 5, y: -1 }, b: { x: 5, y: 1 }, thickness: 3 }];
const thickCover = [{ a: { x: 5, y: -1 }, b: { x: 5, y: 1 }, thickness: 12 }];

test("totalCoverThicknessOnRay stacks segments on the same line", () => {
  const covers = [
    { a: { x: 3, y: -1 }, b: { x: 3, y: 1 }, thickness: 2 },
    { a: { x: 6, y: -1 }, b: { x: 6, y: 1 }, thickness: 4 },
  ];
  assert.equal(totalCoverThicknessOnRay(observer, target, covers), 6);
});

test("novice treats any cover as a hard block regardless of penetration", () => {
  const profile = getNpcDifficultyProfile("novice");
  const result = resolveCoverEngagement({
    profile,
    observer,
    target,
    penetration: 99,
    hasLocatedShot: true,
    covers: thinCover,
  });
  assert.deepEqual(result, { kind: "blocked", reason: "cover" });
});

test("trained blocks when penetration is below stacked thickness", () => {
  const profile = getNpcDifficultyProfile("trained");
  assert.equal(
    canDealDamageThroughCover({
      profile,
      observer,
      target,
      penetration: 2,
      hasLocatedShot: false,
      covers: thickCover,
    }),
    false,
  );
});

test("trained allows damage when penetration meets thickness", () => {
  const profile = getNpcDifficultyProfile("trained");
  const result = resolveCoverEngagement({
    profile,
    observer,
    target,
    penetration: 12,
    hasLocatedShot: false,
    covers: thickCover,
  });
  assert.deepEqual(result, { kind: "through_cover", stackedThickness: 12 });
});

test("trained allows located shot through cover without enough penetration", () => {
  const profile = getNpcDifficultyProfile("trained");
  assert.equal(
    canDealDamageThroughCover({
      profile,
      observer,
      target,
      penetration: 1,
      hasLocatedShot: true,
      covers: thickCover,
    }),
    true,
  );
});

test("walls block before cover thickness is considered", () => {
  const profile = getNpcDifficultyProfile("expert");
  const result = resolveCoverEngagement({
    profile,
    observer,
    target,
    penetration: 50,
    hasLocatedShot: true,
    covers: [],
    walls: [{ a: { x: 5, y: -1 }, b: { x: 5, y: 1 } }],
  });
  assert.deepEqual(result, { kind: "blocked", reason: "wall" });
});
