import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_MAP_COVER_PRESETS,
  coverPresetAttrs,
  coverPresetSelectOptions,
  coverPresetsForKind,
  findMatchingCoverPreset,
} from "./combat-map-cover-presets.ts";

test("coverPresetsForKind filters barrier-only and shared presets", () => {
  const barriers = coverPresetsForKind("barrier");
  const concealment = coverPresetsForKind("concealment");
  assert.ok(barriers.some((preset) => preset.id === "concrete"));
  assert.ok(!concealment.some((preset) => preset.id === "concrete"));
  assert.ok(concealment.some((preset) => preset.id === "tree"));
  assert.ok(barriers.some((preset) => preset.id === "sandbag"));
});

test("findMatchingCoverPreset matches AR and SSP", () => {
  const preset = COMBAT_MAP_COVER_PRESETS.find((entry) => entry.id === "brickWall")!;
  assert.equal(
    findMatchingCoverPreset({ ar: String(preset.ar), ssp: String(preset.ssp) }, "barrier")?.id,
    "brickWall",
  );
  assert.equal(findMatchingCoverPreset({ ar: "99", ssp: "99" }, "barrier"), null);
});

test("coverPresetAttrs writes string ar and ssp", () => {
  assert.deepEqual(coverPresetAttrs(COMBAT_MAP_COVER_PRESETS[0]!), { ar: "10", ssp: "15" });
});

test("coverPresetSelectOptions uses i18n for stats suffix", () => {
  const [option] = coverPresetSelectOptions("concealment", (key, params) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  );
  assert.match(option!.label, /combat\.editor\.coverPreset\.stats:/);
});
