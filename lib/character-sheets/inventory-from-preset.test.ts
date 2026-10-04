import assert from "node:assert/strict";
import { test } from "node:test";

import { getItemPreset } from "./item-presets.ts";
import { inventoryDraftFromPreset } from "./inventory-from-preset.ts";

test("inventoryDraftFromPreset copies ranged weapon preset into inventory draft", () => {
  const preset = getItemPreset("opcode-ranged-ar-m4-16", "ranged");
  assert.ok(preset);
  const draft = inventoryDraftFromPreset(preset, "zh");
  assert.equal(draft.kind, "weapon");
  assert.equal(draft.source.presetId, preset.id);
  assert.equal(draft.name, preset.data.name);
  assert.equal(draft.weapon?.type, "ranged");
});

test("inventoryDraftFromPreset copies armor preset metadata", () => {
  const preset = getItemPreset("preset-plate", "armor");
  assert.ok(preset);
  const draft = inventoryDraftFromPreset(preset, "en");
  assert.equal(draft.kind, "armor");
  assert.equal(draft.name, "NIJ 3A");
  assert.equal(draft.source.presetCategory, "armor");
  assert.equal(draft.armor?.material, "uhmpe");
});
