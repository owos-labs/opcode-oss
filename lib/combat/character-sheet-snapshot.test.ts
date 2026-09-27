import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  combatAmmoFromLoadedWeapon,
  combatSnapshotFromCharacterSheet,
  estimateInitiativePool,
  expectedDamageDiceFromDiceExpr,
  selectPrimaryRangedWeapon,
} from "./character-sheet-snapshot.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";
import { readOpcodeInventory } from "../character-sheets/opcodeInventory.ts";
import { countLegalActions } from "../combat-ai/action-feasibility.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { compileCombatMap } from "./map-adapter/compile.ts";
import { loadSimpleMapFixture } from "./scenario-fixture.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

function loadTestChr(): CharacterSheet {
  return loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
}

test("expectedDamageDiceFromDiceExpr reads leading count", () => {
  assert.equal(expectedDamageDiceFromDiceExpr("3d6"), 3);
  assert.equal(expectedDamageDiceFromDiceExpr("3d6+1"), 3);
  assert.equal(expectedDamageDiceFromDiceExpr("2d6-1"), 2);
});

test("estimateInitiativePool scales REF+WIL+marksmanship", () => {
  assert.equal(estimateInitiativePool({ ref: 5, wil: 5, marksmanship: 0 }), 30);
});

test("test-chr sheet yields M4 combat snapshot", () => {
  const sheet = loadTestChr();
  const inventory = readOpcodeInventory(sheet.status);
  const weapon = selectPrimaryRangedWeapon(inventory);
  assert.ok(weapon);
  assert.match(weapon!.name, /M4/i);

  const snapshot = combatSnapshotFromCharacterSheet(sheet, {
    position: { x: 0, y: 0 },
    targets: [
      {
        id: "hostile-1",
        position: { x: 20, y: 0 },
        localization: "full",
        armorByPart: { torso: 25 },
        coverId: null,
      },
    ],
  });

  assert.equal(snapshot.mov, 12);
  assert.equal(snapshot.actorId, sheet.id);
  assert.equal(snapshot.weapon.rangeM, 350);
  assert.equal(snapshot.weapon.rateOfFire, 900);
  assert.equal(snapshot.weapon.semiAutoOrBetter, true);
  assert.equal(snapshot.weapon.accuracy, 0);
  assert.equal(snapshot.ammo.penetration, 0);
  assert.equal(snapshot.ammo.expectedDamageDice, 0);
  assert.equal(snapshot.ammo.roundsInMagazine, 0);
  assert.equal(snapshot.initiativeRemaining, 30);
});

test("planning payload builds from character-derived snapshot", () => {
  const sheet = loadTestChr();
  const snapshot = combatSnapshotFromCharacterSheet(sheet, {
    position: { x: 0, y: 0 },
    targets: [
      {
        id: "hostile-1",
        position: { x: 6, y: 0 },
        localization: "full",
        armorByPart: { torso: 25 },
        coverId: null,
      },
    ],
    initiativeRemaining: 21,
  });
  const payload = buildPlanningPayload(
    {
      ...snapshot,
      ammo: { ...snapshot.ammo, roundsInMagazine: 30 },
    },
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.ok(countLegalActions(payload.feasibility) > 0);
  assert.ok(payload.utility.length > 0);
});

test("combatAmmoFromLoadedWeapon reads chambered ammo damage expression", () => {
  const magId = crypto.randomUUID();
  const ammoId = crypto.randomUUID();
  const weaponId = crypto.randomUUID();
  const drafts = [
    {
      clientKey: crypto.randomUUID(),
      id: weaponId,
      kind: "weapon" as const,
      name: "Rifle",
      count: "1",
      weight: "0",
      desc: "",
      source: {},
      weapon: {
        type: "ranged" as const,
        caliber: "5.56x45",
        range: "350",
        rof: "900",
        accuracy: "0",
        mode: 3,
        reliability: 1,
        weight: "3",
        concealability: 4,
        damage: {},
        magazineId: magId,
        modifications: [],
        skills: [],
      },
    },
    {
      clientKey: crypto.randomUUID(),
      id: magId,
      kind: "magazine" as const,
      name: "Mag",
      count: "1",
      weight: "0",
      desc: "",
      source: {},
      magazine: {
        caliber: "5.56x45",
        capacity: "30",
        loaded: ["A"],
        kinds: { A: ammoId },
      },
    },
    {
      clientKey: crypto.randomUUID(),
      id: ammoId,
      kind: "ammo" as const,
      name: "M855",
      count: "30",
      weight: "0",
      desc: "",
      source: {},
      ammo: {
        caliber: "5.56x45",
        penetration: "33",
        damage: "ball",
        ballDamage: { expression: "3d6+1" },
        buckDamage: {},
        projectileCount: "",
        explosives: [],
      },
    },
  ];
  const ammo = combatAmmoFromLoadedWeapon(drafts[0]!, drafts);
  assert.equal(ammo.penetration, 33);
  assert.equal(ammo.expectedDamageDice, 3);
  assert.equal(ammo.roundsInMagazine, 1);
});
