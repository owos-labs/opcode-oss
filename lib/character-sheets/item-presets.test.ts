import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getItemPreset,
  isItemPresetCategory,
  itemPresetCatalogMetadata,
  itemPresetCategories,
  countItemPresets,
  listItemPresets,
} from "./item-presets.ts";
import { ammoBallDice } from "./item-preset-dto.ts";
import { normalizeLocaleText, resolveLocaleText } from "./locale-text.ts";
import { ammoGroupsStartOpen, groupItemPresets } from "./item-presets.types.ts";

test("item preset catalog exposes every scaffold category", () => {
  assert.deepEqual(itemPresetCategories(), ["items", "melee", "ranged", "attachments", "ammo", "magazines", "throwable", "armor"]);
  assert.ok(listItemPresets("melee").every((item) => item.category === "melee"));
  assert.ok(listItemPresets("armor").some((item) => item.data.type === "armor"));
  assert.equal(listItemPresets("ranged").some((item) => "base_model" in item.data), false);
  assert.equal(listItemPresets("ranged").some((item) => /基础型号/.test(String(item.data.desc))), false);
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "HMG 12.7"));
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "A-971"));
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "AK-545(100)"));
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "AR(M4) 11.5\""));
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "AW .50"));
  assert.ok(listItemPresets("ranged").some((item) => item.data.name === "XM249 Para"));
  assert.equal(listItemPresets("ranged").length, 59);
  assert.equal(listItemPresets("ranged").some((item) => /AR\(A1\)|20mm autocannon|120mm smoothbore/i.test(item.data.name)), false);
  assert.ok(listItemPresets("ranged").every((item) => item.id.startsWith("opcode-ranged-")));
  assert.ok(listItemPresets("ammo").some((item) => item.data.name === "12.7x108 B-32 gl (57-BZ-542 / 7BZ2)"));
  assert.equal(listItemPresets("ammo").length, 55);
  const armor = listItemPresets("armor");
  assert.deepEqual(armor.map((item) => item.data.name), ["NIJ 1", "NIJ 2", "NIJ 3A", "NIJ 3A+", "NIJ 3+", "NIJ 3++", "NIJ 4", "NIJ 4+"]);
  assert.deepEqual((armor[2]?.data.armor as { protection?: { normal?: Record<string, number> } } | undefined)?.protection?.normal, { torso: 35, hand_primary: 17.5, hand_secondary: 17.5 });
  assert.deepEqual((armor[5]?.data.armor as { protection?: { normal?: Record<string, number> } } | undefined)?.protection?.normal, { torso: 60, hand_primary: 30, hand_secondary: 30, leg_left: 15, leg_right: 15 });
  assert.deepEqual((armor[7]?.data.armor as { protection?: { normal?: Record<string, number> } } | undefined)?.protection?.normal, { torso: 75, hand_primary: 75, hand_secondary: 75, leg_left: 37.5, leg_right: 37.5 });
  const ratnik = listItemPresets("ranged").find((item) => item.data.name === "SD Ratnik-54R");
  assert.ok(ratnik);
  assert.ok((ratnik.data.weapon as { modifications?: Record<string, unknown> } | undefined)?.modifications?.stock);
  assert.match(resolveLocaleText(ratnik.data.desc, "zh"), /GRAU.*6V14/);
  const attachment = listItemPresets("attachments").find((item) => item.id === "opcode-attachment-optic");
  assert.deepEqual(normalizeLocaleText(attachment?.data.desc), { en: "Modifies range and accuracy within a designated zoom interval." });
  assert.deepEqual(
    (attachment?.data.attachment as { effect?: unknown } | undefined)?.effect,
    { en: "Modifies range and accuracy within a designated zoom interval." },
  );
  const m4 = listItemPresets("ranged").find((item) => item.id === "opcode-ranged-ar-m4-14-5");
  const loadout = (m4?.data.weapon as { modifications?: Record<string, Record<string, { description?: unknown; name?: string }>> } | undefined)
    ?.modifications?.attachment?.["70000000-0000-4000-8000-000000000099"];
  assert.equal(loadout?.name, "Default loadout");
  assert.deepEqual(normalizeLocaleText(loadout?.description), { zh: "14.5\" 枪管，+0 精度" });
  assert.equal(listItemPresets("ranged").some((item) => /SIG/i.test(JSON.stringify(item.data))), false);
  assert.equal(listItemPresets("ranged").some((item) => /14\.5x|RPG|TOW|Javelin|Kornet|Spike/i.test(JSON.stringify(item.data.weapon))), false);
  assert.equal(listItemPresets("ammo").some((item) => /12GA|20GA|155mm|152mm|203mm|227mm|667/i.test(item.data.name)), false);
});

test("placeholder ranged weapons keep per-model rate of fire", () => {
  const byName = new Map(listItemPresets("ranged").map((item) => [item.data.name, item.data.weapon]));
  assert.equal((byName.get("P17 9x19") as { rof?: number } | undefined)?.rof, 1100);
  assert.equal((byName.get("HMG 12.7") as { rof?: number } | undefined)?.rof, 550);
  assert.equal((byName.get("AW .50") as { rof?: number } | undefined)?.rof, 8);
  assert.ok(new Set(listItemPresets("ranged").map((item) => (item.data.weapon as { rof?: number })?.rof)).size > 5);
});

test("placeholder ammo rounds keep listed caliber, damage, and penetration", () => {
  const byName = new Map(listItemPresets("ammo").map((item) => [item.data.name, item.data.ammo]));
  const rows: [string, string, string, string][] = [
    ["4.6x30 AP SX", "4.6x30", "2d4-1", "30"],
    ["4.6x30 FMJ SX", "4.6x30", "2d4", "20"],
    ["5.45x39 PS gs (7N6)", "5.45x39", "3d6+1", "35"],
    ["5.45x39 PP gs (7N10)", "5.45x39", "3d6", "40"],
    ["5.45x39 BP gs (7N22)", "5.45x39", "3d6-1", "45"],
    ["5.45x39 BS gs (7N24)", "5.45x39", "3d6-2", "50"],
    ["5.45x39 PPBS gs (7N39)", "5.45x39", "3d6-2", "55"],
    ["5.56x45 FMJ", "5.56x45", "3d6", "33"],
    ["5.56x45 SP BT", "5.56x45", "3d6+1", "20"],
    ["5.56x45 FMJBT Ball (M855)", "5.56x45", "3d6", "35"],
    ["5.56x45 FMJBT EPR (M855A1)", "5.56x45", "3d6-1", "45"],
    ["5.56x45 FMJBT AP (M995)", "5.56x45", "3d6-2", "55"],
    ["5.7x28 Tracer (L191)", "5.7x28", "2d4", "30"],
    ["5.7x28 Subsonic (SB193)", "5.7x28", "2d4-1", "10"],
    ["5.7x28 Ball (SS190)", "5.7x28", "2d4", "30"],
    ["5.7x28 V-Max (SS197SR)", "5.7x28", "2d4+1", "10"],
    ["7.62x25 TT SP", "7.62x25TT", "3d4+1", "12"],
    ["7.62x25 TT FMJ", "7.62x25TT", "3d4", "20"],
    ["7.62x25 TT Pst gzh (57-N-134S)", "7.62x25TT", "3d4-1", "30"],
    ["7.62x39 T-45M1 gzh (57-T-231PM1)", "7.62x39", "4d6-2", "35"],
    ["7.62x39 SP", "7.62x39", "4d6+1", "20"],
    ["7.62x39 PS gzh (57-N-231)", "7.62x39", "4d6-2", "35"],
    ["7.62x39 BP gzh (7N23)", "7.62x39", "4d6-3", "50"],
    ["7.62x39 US gzh (57-N-231U)", "7.62x39", "4d6-3", "25"],
    ["7.62x54R SN gzh (7N1)", "7.62x54R", "5d6+1", "50"],
    ["7.62x54R BT gzh (7BT1)", "7.62x54R", "5d6", "55"],
    ["7.62x54R LPS gzh (57-N-323S)", "7.62x54R", "5d6+4", "40"],
    ["7.62x54R T-46M gzh (7T2M)", "7.62x54R", "5d6+3", "40"],
    ["7.62x54R SNB gzh (7N14)", "7.62x54R", "5d6-2", "65"],
    ["9x19 FMJ", "9x19", "2d4", "15"],
    ["9x19 RIP", "9x19", "2d4+3", "10"],
    ["9x19 PBP gzh (7N31)", "9x19", "2d4-1", "30"],
    ["9x39 FMJ", "9x39", "4d4+2", "20"],
    ["9x39 SP-5 gs (7N8)", "9x39", "4d4+2", "25"],
    ["9x39 SP-6 gs (7N9)", "9x39", "4d4", "35"],
    ["9x39 BP gs (7N12)", "9x39", "4d4-1", "45"],
    [".300 BLK AP", ".300BLK", "4d6-3", "45"],
    [".300 BLK V-Max", ".300BLK", "4d6+2", "18"],
    [".300 BLK Whisper", ".300BLK", "3d6+2", "15"],
    [".338 LM FMJ", ".338LM", "6d6-2", "70"],
    [".338 LM AP", ".338LM", "6d6-4", "90"],
    [".45 ACP FMJ", ".45ACP", "3d4+2", "17"],
    [".45 ACP RIP", ".45ACP", "3d4+4", "10"],
    [".45 ACP AP", ".45ACP", "3d4", "25"],
    ["12.7x55 PS12A", "12.7x55", "6d6+3", "25"],
    ["12.7x55 PS12B", "12.7x55", "6d6", "45"],
    ["12.7x99 Tracer (M21)", "12.7x99", "5d10+4", "65"],
    ["12.7x99 Ball (M33)", "12.7x99", "5d10+5", "70"],
    ["12.7x99 SLAP (M903)", "12.7x99", "5d10-3", "225"],
    ["12.7x108 B-32 gl (57-BZ-542 / 7BZ2)", "12.7x108", "6d10-4", "200"],
    ["12.7x108 API (7BZ7)", "12.7x108", "6d10-4", "220"],
    ["12.7x108 BZT-44 gl (57-BZT-542)", "12.7x108", "6d10-3", "190"],
    ["14.5x114 MDZ gs (57-Z-564S)", "14.5x114", "7d10+2", "80"],
    ["14.5x114 B-32 gs (57-BZ-561S)", "14.5x114", "7d10-2", "220"],
    ["14.5x114 BS-41 gl (57-BZ-562)", "14.5x114", "7d10-4", "320"],
  ];
  for (const [name, caliber, damage, penetration] of rows) {
    const ammo = byName.get(name);
    assert.equal(ammo?.caliber, caliber, name);
    assert.equal(ammo?.damage, "ball", name);
    assert.equal(ammoBallDice(ammo), damage, name);
    assert.equal(ammo?.penetration, Number(penetration), name);
  }
});

test("ammo presets group by caliber and other categories stay flat", () => {
  const groups = groupItemPresets("ammo", listItemPresets("ammo"));
  assert.deepEqual(groups.map((group) => group.label), [
    "4.6x30", "5.45x39", "5.56x45", "5.7x28", "7.62x25TT", "7.62x39", "7.62x54R",
    "9x19", "9x39", ".300BLK", ".338LM", ".45ACP", "12.7x55", "12.7x99", "12.7x108", "14.5x114",
  ]);
  assert.deepEqual(groups.find((group) => group.label === "5.56x45")?.items.map((item) => item.data.name), [
    "5.56x45 FMJ", "5.56x45 SP BT", "5.56x45 FMJBT Ball (M855)", "5.56x45 FMJBT EPR (M855A1)", "5.56x45 FMJBT AP (M995)",
  ]);
  const rangedGroups = groupItemPresets("ranged", listItemPresets("ranged"));
  assert.ok(rangedGroups.length > 1);
  assert.deepEqual(rangedGroups.find((group) => group.label === "5.56x45")?.items.map((item) => item.data.name), [
    "AR(M4) 14.5\"", "AR(M4) 16\"", "AR(M4) 11.5\"", "AR(M16) 20\"", "AR(M4 DMR) 20\"", "ACR 16\"",
    "XM249 Para", "AR(416)", "AR(416) A5 11\"", "AUR-A3 16\"", "Gewehr 36 (S)",
  ]);
  const ammoCalibers = new Set(groups.map((group) => group.label));
  for (const item of listItemPresets("ranged")) {
    const caliber = (item.data.weapon as { caliber?: string } | undefined)?.caliber ?? "";
    assert.ok(ammoCalibers.has(caliber) || caliber === "20x82", `${item.data.name} ${caliber}`);
  }
  assert.equal(ammoGroupsStartOpen(""), false);
  assert.equal(ammoGroupsStartOpen("  "), false);
  assert.equal(ammoGroupsStartOpen("fmj"), true);
});

test("item preset catalog filters by keyword", () => {
  const results = listItemPresets(undefined, "11.5");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.data.name, "AR(M4) 11.5\"");
});

test("item preset catalog reports counts for every category", () => {
  const counts = countItemPresets();
  assert.deepEqual(Object.keys(counts), ["items", "melee", "ranged", "attachments", "ammo", "magazines", "throwable", "armor"]);
  assert.equal(counts.ranged, listItemPresets("ranged").length);
  assert.equal(counts.armor, 8);

  const filtered = countItemPresets("11.5");
  assert.equal(filtered.items + filtered.melee + filtered.ranged + filtered.attachments + filtered.ammo + filtered.magazines + filtered.throwable + filtered.armor, 1);
  assert.equal(filtered.ranged, 1);
});

test("item preset catalog exposes metadata and single item lookup", () => {
  assert.deepEqual(itemPresetCatalogMetadata(), { version: 1, updated_at: "2026-09-27T00:00:00.000Z" });
  assert.equal(isItemPresetCategory("armor"), true);
  assert.equal(isItemPresetCategory("unknown"), false);
  assert.equal(getItemPreset("preset-knife")?.category, "melee");
  assert.equal(getItemPreset("preset-knife", "armor"), null);
  assert.equal(getItemPreset("missing"), null);
});
