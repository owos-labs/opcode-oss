import assert from "node:assert/strict";
import test from "node:test";

import {
  damageDiceExprFromAmmoDraft,
  damageDiceExprFromDamageRecord,
  setAmmoDamageDice,
  setAmmoDamageKind,
  setDamageDiceOnRecord,
} from "./opcode-ammo-damage.ts";

test("damageDiceExprFromDamageRecord reads dice and expression", () => {
  assert.equal(damageDiceExprFromDamageRecord({ dice: "3d6" }), "3d6");
  assert.equal(damageDiceExprFromDamageRecord({ expression: "3d6-2" }), "3d6-2");
  assert.equal(
    damageDiceExprFromDamageRecord({ damage: { dice: "2d6+1" } }),
    "2d6+1",
  );
});

test("damageDiceExprFromAmmoDraft reads ballDamage when damage kind omitted", () => {
  assert.equal(
    damageDiceExprFromAmmoDraft({
      caliber: "5.56x45",
      penetration: "33",
      damage: "",
      ballDamage: { dice: "3d6" },
      buckDamage: {},
      projectileCount: "",
      explosives: [],
    }),
    "3d6",
  );
});

test("damageDiceExprFromAmmoDraft uses active damage kind branch", () => {
  assert.equal(
    damageDiceExprFromAmmoDraft({
      caliber: "5.56x45",
      penetration: "33",
      damage: "ball",
      ballDamage: { expression: "3d6+1" },
      buckDamage: {},
      projectileCount: "",
      explosives: [],
    }),
    "3d6+1",
  );
});

test("setAmmoDamageDice writes ball dice and clears expression", () => {
  const ammo = {
    caliber: "5.56x45",
    penetration: "33",
    damage: "ball" as const,
    ballDamage: { expression: "3d6+1" },
    buckDamage: {},
    projectileCount: "",
    explosives: [],
  };
  setAmmoDamageDice(ammo, " 2d6 ");
  assert.deepEqual(ammo.ballDamage, { dice: "2d6" });
  assert.equal(damageDiceExprFromAmmoDraft(ammo), "2d6");
  setAmmoDamageDice(ammo, "");
  assert.deepEqual(ammo.ballDamage, {});
});

test("setAmmoDamageDice writes buck and explosive branches", () => {
  const ammo = {
    caliber: "12x70",
    penetration: "10",
    damage: "buck" as const,
    ballDamage: {},
    buckDamage: { expression: "2d6" },
    projectileCount: "5",
    explosives: [],
  };
  setAmmoDamageDice(ammo, "1d6");
  assert.deepEqual(ammo.buckDamage, { dice: "1d6" });

  setAmmoDamageKind(ammo, "explosive");
  assert.equal(ammo.explosives.length, 1);
  setAmmoDamageDice(ammo, "4d6");
  assert.deepEqual(ammo.explosives[0]?.damage, { dice: "4d6" });
  assert.equal(damageDiceExprFromAmmoDraft(ammo), "4d6");
});

test("setDamageDiceOnRecord keeps melee expression editable as dice", () => {
  assert.deepEqual(setDamageDiceOnRecord({ expression: "2d6+1" }, "3d4"), { dice: "3d4" });
});
