import assert from "node:assert/strict";
import test from "node:test";
import { defaultCombatSnapshot } from "../scenario-fixture.ts";
import {
  pointInSuppressiveFireArea,
  scoreSuppressiveFire,
  formatAttackChoiceReason,
  suppressiveFireAffectedTargets,
} from "./suppressive-action.ts";

const map = { walls: [], barriers: [] };

test("suppression expectation includes reflex saves and never invents kill probabilities", () => {
  const base = defaultCombatSnapshot({ attackBonus: 10 });
  const snapshot = { ...base, weapon: { ...base.weapon, rateOfFire: 40 }, ammo: { ...base.ammo, penetration: 0, expectedDamageDice: 1, damageDiceExpr: "1d6" }, targets: [{ ...base.targets[0]!, armorByPart: {}, reflexSaveBonus: 10 }] };
  const score = scoreSuppressiveFire(snapshot, map);
  // Enumerate the two D10 rolls, the hit die and all six damage faces independently.
  let damage = 0;
  for (let attack = 1; attack <= 10; attack++) for (let save = 1; save <= 10; save++) {
    if (save >= attack) continue;
    for (let hitsDie = 1; hitsDie <= 2; hitsDie++) {
      const hits = Math.min(2, Math.min(hitsDie, Math.max(0, attack + 10 - 15)));
      for (let die = 1; die <= 6; die++) damage += hits * die * (attack === 10 ? 2 : 1) / 1200;
    }
  }
  assert.ok(Math.abs(score.expectedDamage - damage) < 1e-9);
  assert.equal(score.utility, score.expectedDamage);
  assert.equal(scoreSuppressiveFire({ ...snapshot, targets: [{ ...snapshot.targets[0]!, reflexSaveBonus: 100 }] }, map).expectedDamage, 0);
  const label = formatAttackChoiceReason({ chosen: "standard_fire", suppress: score, bestFire: 2 });
  assert.match(label, /预期伤害/);
  assert.doesNotMatch(label, /清场|概率|击杀/);
});

test("suppressive zone counts targets with line of sight, not long-range visibility arc", () => {
  const from = { x: 0, y: 0 };
  const aim = { x: 10, y: 0 };
  const target = { x: 10, y: 0 };
  const walls = [
    { a: { x: 5, y: -5 }, b: { x: 5, y: -0.6 } },
    { a: { x: 5, y: 0.6 }, b: { x: 5, y: 5 } },
  ];
  const weaponRangeM = 400;
  assert.equal(
    pointInSuppressiveFireArea(from, aim, target, walls, weaponRangeM),
    true,
  );
  assert.deepEqual(
    suppressiveFireAffectedTargets(from, aim, [{ id: "t", position: target }], walls, weaponRangeM),
    [{ id: "t", position: target }],
  );
  const base = defaultCombatSnapshot({ attackBonus: 10, position: from });
  const snapshot = {
    ...base,
    weapon: { ...base.weapon, rangeM: weaponRangeM, rateOfFire: 40 },
    targets: [{ ...base.targets[0]!, id: "t", position: target, localization: "full" as const }],
  };
  const score = scoreSuppressiveFire(snapshot, { walls, barriers: [] }, from);
  assert.equal(score.willHitCount, 1);
  assert.ok(score.expectedDamage > 0);
});

test("suppressive wedge covers units between boundary rays through the aim patch", () => {
  const from = { x: 0, y: 0 };
  const aim = { x: 20, y: 0 };
  const walls: typeof import("../../combat-ai/visibility.ts").WallSegment[] = [];
  assert.equal(pointInSuppressiveFireArea(from, aim, { x: 10, y: 1 }, walls, 400), true);
  assert.equal(pointInSuppressiveFireArea(from, aim, { x: 10, y: 6 }, walls, 400), false);
  assert.equal(pointInSuppressiveFireArea(from, aim, { x: 25, y: 0 }, walls, 400), true);
  assert.equal(pointInSuppressiveFireArea(from, aim, { x: 25, y: 10 }, walls, 400), false);
});

test("suppression shares ammo between targets and respects the remaining round quota", () => {
  const base = defaultCombatSnapshot({ attackBonus: 30 });
  const snapshot = { ...base, weapon: { ...base.weapon, rateOfFire: 40 }, targets: [base.targets[0]!, { ...base.targets[0]!, id: "b", position: { x: 6.5, y: 0 } }] };
  const score = scoreSuppressiveFire(snapshot, map);
  assert.equal(score.willHitCount, 2);
  assert.ok(score.expectedHits <= 2 + 1e-9);
  assert.ok(scoreSuppressiveFire({ ...snapshot, weaponRoundsThisRound: 1 }, map).expectedHits <= 1 + 1e-9);
  assert.equal(scoreSuppressiveFire({ ...snapshot, weaponRoundsThisRound: 2 }, map).utility, -Infinity);
  const fractional = scoreSuppressiveFire({ ...snapshot, attackBonus: 15.5 }, map);
  assert.ok(Number.isFinite(fractional.expectedDamage));
  assert.ok(fractional.expectedHits <= 2 + 1e-9);
});
