import assert from "node:assert/strict";
import test from "node:test";

import { getItemPreset } from "./item-presets.ts";
import { listItemPresetDetailRows, listItemPresetModifications } from "./item-preset-detail.ts";

test("listItemPresetDetailRows formats ranged weapon stats", () => {
  const preset = getItemPreset("opcode-ranged-ar-m4-16", "ranged");
  assert.ok(preset);
  const rows = listItemPresetDetailRows(preset.category, preset.data, "zh");
  const byKey = Object.fromEntries(rows.map((row) => [row.labelKey, row.value]));
  assert.equal(byKey["characterSheets.inventory.weapon.weaponType"], "characterSheets.inventory.weapon.types.ranged");
  assert.equal(byKey["characterSheets.inventory.fields.caliber"], "5.56x45");
  assert.equal(byKey["characterSheets.inventory.weapon.range"], "400 m");
  assert.equal(byKey["characterSheets.inventory.weapon.rof"], "900/min");
  assert.match(byKey["characterSheets.inventory.weapon.mode"], /semi/);
});

test("listItemPresetModifications lists weapon loadout parts", () => {
  const preset = getItemPreset("opcode-ranged-sd-ratnik-54r", "ranged");
  assert.ok(preset);
  const mods = listItemPresetModifications(preset.data, "zh");
  assert.equal(mods.length, 4);
  assert.ok(mods.some((mod) => mod.slot === "receiver"));
});

test("listItemPresetDetailRows formats armor protection", () => {
  const preset = getItemPreset("preset-plate", "armor");
  assert.ok(preset);
  const rows = listItemPresetDetailRows(preset.category, preset.data, "en");
  const byKey = Object.fromEntries(rows.map((row) => [row.labelKey, row.value]));
  assert.equal(byKey["characterSheets.health.torso"], "35");
  assert.equal(byKey["characterSheets.health.hand_primary"], "17.5");
});
