import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonCaliber,
  createOpcodeInventoryDraft,
  createOpcodeModEffectDraft,
  fillMagazine,
  groupInventoryByKind,
  installWeaponModification,
  patchWeaponModification,
  removeWeaponModification,
  inventoryItemFromQuery,
  inventoryListFacts,
  inventoryMatchesQuery,
  inventoryMoveBefore,
  normalizeOpcodeAmmoDamageKind,
  readOpcodeInventory,
  roundsForPresetLoad,
  sameCaliber,
  setWeaponMagazine,
  writeOpcodeInventory,
} from "./opcodeInventory.ts";

test("normalizeOpcodeAmmoDamageKind falls back to ball", () => {
  assert.equal(normalizeOpcodeAmmoDamageKind("ball"), "ball");
  assert.equal(normalizeOpcodeAmmoDamageKind("实心弹"), "ball");
});

test("inventoryListFacts shows count and the fields that kind actually has", () => {
  const knife = createOpcodeInventoryDraft("weapon");
  knife.name = "Knife";
  knife.count = "2";
  knife.weapon!.weight = "1.5";
  assert.deepEqual(inventoryListFacts(knife), ["×2", "melee", "1.5 kg"]);

  const plate = createOpcodeInventoryDraft("armor");
  plate.weight = "2.5";
  assert.deepEqual(inventoryListFacts(plate), ["×1", "ceramic", "2.5 kg"]);

  assert.equal(inventoryMatchesQuery(knife, "knife"), true);
  assert.equal(inventoryMatchesQuery(knife, "1.5"), true);
  assert.equal(inventoryMatchesQuery(knife, "plate"), false);
  assert.equal(inventoryMatchesQuery(knife, "  "), true);
});

test("item weight roundtrips on non-weapons and stays on the weapon block for weapons", () => {
  const bandage = createOpcodeInventoryDraft("generic");
  bandage.weight = "0.1";
  bandage.count = "3";
  const knife = createOpcodeInventoryDraft("weapon");
  knife.weapon!.weight = "0.3";
  const written = writeOpcodeInventory([bandage, knife]);
  assert.equal(written[0]?.weight, 0.1);
  assert.equal(written[1]?.weight, undefined);
  assert.equal((written[1]?.weapon as { weight: number }).weight, 0.3);
  const [readBandage, readKnife] = readOpcodeInventory({ inventory: written });
  assert.equal(readBandage?.weight, "0.1");
  assert.equal(readKnife?.weapon?.weight, "0.3");
});

test("groupInventoryByKind keeps list order and skips empty kinds", () => {
  const ammo = createOpcodeInventoryDraft("ammo");
  const weapon = createOpcodeInventoryDraft("weapon");
  const groups = groupInventoryByKind([ammo, weapon]);
  assert.deepEqual(groups.map((group) => group.kind), ["weapon", "ammo"]);
  assert.equal(groups[0]?.items[0], weapon);
  assert.equal(groupInventoryByKind([]).length, 0);
});

test("inventoryMoveBefore steps inside the visible group", () => {
  assert.equal(inventoryMoveBefore(["a", "b", "c"], "a", 1), "c");
  assert.equal(inventoryMoveBefore(["a", "b", "c"], "c", -1), "b");
  assert.equal(inventoryMoveBefore(["a", "b"], "a", -1), undefined);
  assert.equal(inventoryMoveBefore(["a", "b"], "a", 1), null);
  assert.equal(inventoryMoveBefore(["a", "b"], "b", 1), undefined);
});

test("fillMagazine loads until the magazine or the stack runs out", () => {
  const magazine = createOpcodeInventoryDraft("magazine");
  magazine.magazine!.caliber = "9mm";
  magazine.magazine!.containsMax = "2";
  const ammo = createOpcodeInventoryDraft("ammo");
  ammo.ammo!.caliber = "9mm";
  ammo.count = "5";
  const result = fillMagazine([magazine, ammo], magazine.id, ammo.id);
  assert.equal(result.ok, true);
  assert.equal(result.drafts.find((item) => item.id === magazine.id)?.magazine?.loaded.length, 2);
  assert.equal(result.drafts.find((item) => item.id === ammo.id)?.count, "3");

  ammo.ammo!.caliber = "5.56";
  const mismatch = fillMagazine([magazine, ammo], magazine.id, ammo.id);
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.drafts.find((item) => item.id === ammo.id)?.count, "5");
});

test("roundsForPresetLoad tops up a new or empty stack to the free slots", () => {
  assert.equal(roundsForPresetLoad(1, 30, true), 30);
  assert.equal(roundsForPresetLoad(0, 12, false), 12);
  assert.equal(roundsForPresetLoad(10, 30, false), 10);
  assert.equal(roundsForPresetLoad(40, 30, false), 40);
});

test("setWeaponMagazine seats a matching magazine and rejects a different caliber", () => {
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.weapon!.type = "ranged";
  weapon.weapon!.caliber = "9mm";
  const magazine = createOpcodeInventoryDraft("magazine");
  magazine.magazine!.caliber = "9mm";
  const seated = setWeaponMagazine([weapon, magazine], weapon.id, magazine.id);
  assert.equal(seated.ok, true);
  assert.equal(seated.drafts.find((item) => item.id === weapon.id)?.weapon?.magazineId, magazine.id);

  magazine.magazine!.caliber = "9×19";
  weapon.weapon!.caliber = "9x19";
  const spelled = setWeaponMagazine([weapon, magazine], weapon.id, magazine.id);
  assert.equal(spelled.ok, true);
  assert.equal(sameCaliber("5.56×45", "5.56x45"), true);
  assert.equal(sameCaliber("", "5.56×45"), false);

  magazine.magazine!.caliber = "5.56";
  const rejected = setWeaponMagazine([weapon, magazine], weapon.id, magazine.id);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.drafts.find((item) => item.id === weapon.id)?.weapon?.magazineId, "");
});

test("installWeaponModification replaces the same slot and lists the name", () => {
  const weapon = createOpcodeInventoryDraft("weapon");
  const first = installWeaponModification([weapon], weapon.id, {
    slot: "optic",
    name: "Red dot",
    description: "",
    source: { presetId: "optic-1" },
  });
  assert.equal(first.ok, true);
  const replaced = installWeaponModification(first.drafts, weapon.id, {
    slot: "optic",
    name: "Scope",
    description: "zoom",
    source: { presetId: "optic-2" },
  });
  const mods = replaced.drafts[0]?.weapon?.modifications ?? [];
  assert.equal(mods.length, 1);
  assert.equal(mods[0]?.name, "Scope");
  assert.deepEqual(inventoryListFacts(replaced.drafts[0]!), ["×1", "melee", "0 kg"]);
  const edited = patchWeaponModification(replaced.drafts, weapon.id, mods[0]!.id, { name: "ACOG", description: "4x" });
  assert.equal(edited.drafts[0]?.weapon?.modifications[0]?.name, "ACOG");
  assert.equal(edited.drafts[0]?.weapon?.modifications[0]?.description, "4x");
  const removed = removeWeaponModification(edited.drafts, weapon.id, mods[0]!.id);
  assert.equal(removed.drafts[0]?.weapon?.modifications.length, 0);

  const barrel = installWeaponModification(replaced.drafts, weapon.id, {
    slot: "magazine",
    name: "Mag well",
    description: "",
    source: {},
  });
  const slots = barrel.drafts[0]?.weapon?.modifications.map((item) => item.slot);
  assert.deepEqual(slots, ["optic", "magazineMod"]);
});

test("melee damage is the rd dice payload on the weapon", () => {
  const knife = createOpcodeInventoryDraft("weapon");
  knife.weapon!.damage = { dice: "2d6+1" };
  assert.deepEqual(inventoryListFacts(knife), ["×1", "melee", "2d6+1", "0 kg"]);
  const written = writeOpcodeInventory([knife]);
  assert.deepEqual((written[0]?.weapon as { damage: unknown }).damage, { dice: "2d6+1" });
  const [read] = readOpcodeInventory({ inventory: written });
  assert.deepEqual(read?.weapon?.damage, { dice: "2d6+1" });
});

test("attachment effects write the mod or enable_slot payload", () => {
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.weapon!.type = "ranged";
  const installed = installWeaponModification([weapon], weapon.id, {
    slot: "muzzle",
    name: "Suppressor",
    description: "",
    source: {},
  });
  const id = installed.drafts[0]!.weapon!.modifications[0]!.id;
  const stat = createOpcodeModEffectDraft("mod");
  stat.target = "accuracy";
  stat.flat = "1";
  const slot = createOpcodeModEffectDraft("enable_slot");
  slot.slot = "sight";
  slot.count = "1";
  slot.max = "1";
  const patched = patchWeaponModification(installed.drafts, weapon.id, id, { effects: [stat, slot] });
  const written = writeOpcodeInventory(patched.drafts);
  const effects = (written[0]?.weapon as {
    modifications: Record<string, Record<string, { effects: Record<string, unknown> }>>
  }).modifications.muzzle[id].effects;
  assert.deepEqual(effects["1"], { mod: { target: "accuracy", value: { flat: 1 } } });
  assert.deepEqual(effects["2"], { enable_slot: "sight", count: 1, max: 1 });
  const [read] = readOpcodeInventory({ inventory: written });
  assert.equal(read?.weapon?.modifications[0]?.effects[0]?.flat, "1");
  assert.equal(read?.weapon?.modifications[0]?.effects[1]?.slot, "sight");
});

test("calibers are written with an ascii x", () => {
  assert.equal(canonCaliber("5.56×45"), "5.56x45");
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.weapon!.type = "ranged";
  weapon.weapon!.caliber = "5.56×45";
  const written = writeOpcodeInventory([weapon]);
  assert.equal((written[0]?.weapon as { caliber: string }).caliber, "5.56x45");
  const [read] = readOpcodeInventory({ inventory: written });
  assert.equal(read?.weapon?.caliber, "5.56x45");
});

test("inventoryItemFromQuery only selects an item that exists", () => {
  const item = createOpcodeInventoryDraft("generic");
  assert.equal(inventoryItemFromQuery(item.id, [item]), item.id);
  assert.equal(inventoryItemFromQuery("missing", [item]), null);
  assert.equal(inventoryItemFromQuery(undefined, [item]), null);
});
