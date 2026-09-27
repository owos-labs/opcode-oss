import assert from "node:assert/strict";
import { test } from "node:test";

import {
  armorPenetrationDamageFactor,
  armorRatingForPart,
  expectedArmorPenetration,
  maxArmorRating,
  penetrationExpectation,
} from "./armor-penetration.ts";
import { getNpcDifficultyProfile } from "./difficulty.ts";

test("penetrationExpectation compares ammo penetration to armor rating", () => {
  assert.deepEqual(penetrationExpectation(55, 45), {
    expectedPenetrates: true,
    margin: 10,
  });
  assert.deepEqual(penetrationExpectation(30, 45), {
    expectedPenetrates: false,
    margin: -15,
  });
});

test("armorRatingForPart reads protection map", () => {
  assert.equal(armorRatingForPart({ torso: 45, head: 0 }, "torso"), 45);
  assert.equal(armorRatingForPart({ torso: 45 }, "leg"), 0);
});

test("maxArmorRating is conservative when hit part is unknown", () => {
  assert.equal(maxArmorRating({ torso: 20, hand_primary: 45 }), 45);
});

test("novice tier enables armor penetration expectation", () => {
  const profile = getNpcDifficultyProfile("novice");
  const exp = expectedArmorPenetration({
    profile,
    ammoPenetration: 40,
    targetArmor: { torso: 45 },
    hitPart: "torso",
  });
  assert.ok(exp);
  assert.equal(exp.expectedPenetrates, false);
  assert.equal(armorPenetrationDamageFactor(exp), 0);
});

test("newstupid ignores armor penetration planning", () => {
  const profile = getNpcDifficultyProfile("newstupid");
  assert.equal(
    expectedArmorPenetration({
      profile,
      ammoPenetration: 10,
      targetArmor: { torso: 99 },
    }),
    null,
  );
  assert.equal(armorPenetrationDamageFactor(null), 1);
});
