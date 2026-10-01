import assert from "node:assert/strict";
import test from "node:test";

import type { BallisticBarrier } from "../combat-ai/geometry.ts";
import {
  enteredCoverBlocksRangedShot,
  mapCoverBandOnLineOfEffect,
  MAP_COVER_BENEFIT_RADIUS_M,
  rangedAttackDifficultyForTarget,
} from "./ranged-attack-cover.ts";

const bag: BallisticBarrier = {
  id: "bag",
  a: { x: 5, y: -1 },
  b: { x: 5, y: 1 },
  armorRating: 4,
  maxSsp: 20,
  currentSsp: 20,
  blocksVision: false,
  coverHeightBand: "half",
};

test("entered cover blocks shots across the emplacement on the line of effect", () => {
  assert.equal(
    enteredCoverBlocksRangedShot({
      shooterCoverId: "bag",
      shooter: { x: 4, y: 0 },
      target: { x: 8, y: 0 },
      barriers: [bag],
    }),
    true,
  );
  assert.equal(
    enteredCoverBlocksRangedShot({
      shooterCoverId: "bag",
      shooter: { x: 4, y: 0 },
      target: { x: 2, y: 0 },
      barriers: [bag],
    }),
    false,
  );
  assert.equal(
    enteredCoverBlocksRangedShot({
      shooterCoverId: null,
      shooter: { x: 4, y: 0 },
      target: { x: 8, y: 0 },
      barriers: [bag],
    }),
    false,
  );
});

test("map cover band applies when defender is within 3m and not entered", () => {
  const band = mapCoverBandOnLineOfEffect({
    shooter: { x: 0, y: 0 },
    target: { x: 6, y: 0 },
    targetEnteredCoverId: null,
    barriers: [bag],
    benefitRadiusM: MAP_COVER_BENEFIT_RADIUS_M,
  });
  assert.equal(band, "half");

  const far = mapCoverBandOnLineOfEffect({
    shooter: { x: 0, y: 0 },
    target: { x: 20, y: 0 },
    targetEnteredCoverId: null,
    barriers: [bag],
  });
  assert.equal(far, undefined);
});

test("rangedAttackDifficultyForTarget adds map cover height when in benefit radius", () => {
  const open = rangedAttackDifficultyForTarget({
    shooter: { x: 0, y: 0 },
    target: { x: 20, y: 0 },
    weaponRangeM: 400,
    localization: "full",
    targetCoverId: null,
    barriers: [bag],
  });
  const covered = rangedAttackDifficultyForTarget({
    shooter: { x: 0, y: 0 },
    target: { x: 6, y: 0 },
    weaponRangeM: 400,
    localization: "full",
    targetCoverId: null,
    barriers: [bag],
  });
  assert.ok(covered.total > open.total);
  assert.equal(covered.cover, 3);
});
