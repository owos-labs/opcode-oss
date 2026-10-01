import assert from "node:assert/strict";
import test from "node:test";

import {
  applyUnderPenetrationDamageFloor,
  armorAdjustedDamageDice,
} from "./armor-penetration-damage.ts";

test("armorAdjustedDamageDice quarters dice on under-penetration", () => {
  assert.deepEqual(armorAdjustedDamageDice({ baseDice: 8, penetrationMargin: -5 }), {
    maxDice: 2,
    kind: "under",
  });
  assert.deepEqual(armorAdjustedDamageDice({ baseDice: 3, penetrationMargin: -1 }), {
    maxDice: 1,
    kind: "under",
  });
});

test("armorAdjustedDamageDice reduces dice on over-penetration with half floor", () => {
  assert.deepEqual(armorAdjustedDamageDice({ baseDice: 6, penetrationMargin: 25 }), {
    maxDice: 4,
    kind: "over",
  });
  assert.deepEqual(armorAdjustedDamageDice({ baseDice: 6, penetrationMargin: 35 }), {
    maxDice: 3,
    kind: "over",
  });
  assert.deepEqual(armorAdjustedDamageDice({ baseDice: 6, penetrationMargin: 0 }), {
    maxDice: 6,
    kind: "normal",
  });
});

test("applyUnderPenetrationDamageFloor enforces minimum 1 on under-pen", () => {
  assert.equal(applyUnderPenetrationDamageFloor("under", 0), 1);
  assert.equal(applyUnderPenetrationDamageFloor("normal", 0), 0);
});
