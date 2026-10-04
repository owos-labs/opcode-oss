import assert from "node:assert/strict";
import test from "node:test";

import {
  boundingBoxElement,
  createDefaultCombatMapSvg,
  updateCombatMapElement,
} from "./combat-map-document.ts";
import {
  combatMapMetersPerUnit,
  ensureCombatMapMetersPerUnit,
  formatMapMeters,
  mapSizeLabelMeters,
  meterFieldToSvgLength,
  metersToSvgUnits,
  readSvgMetersPerUnit,
  svgLengthToMeterField,
  svgUnitsToMeters,
} from "./combat-map-units.ts";

test("combatMapMetersPerUnit uses stored scale, not live bounds width", () => {
  const svg = createDefaultCombatMapSvg();
  const mpu = combatMapMetersPerUnit(svg);
  assert.equal(mpu, 0.02);
  assert.equal(svgUnitsToMeters(1000, mpu), 20);
});

test("changing map width in meters keeps height in meters stable", () => {
  let svg = createDefaultCombatMapSvg();
  const bounds = boundingBoxElement(svg)!;
  const heightBefore = svgLengthToMeterField(bounds.attrs.height, combatMapMetersPerUnit(svg));
  svg = updateCombatMapElement(svg, bounds.id, { width: "1500" });
  const nextBounds = boundingBoxElement(svg)!;
  assert.equal(svgLengthToMeterField(nextBounds.attrs.height, combatMapMetersPerUnit(svg)), heightBefore);
  assert.equal(svgLengthToMeterField(nextBounds.attrs.width, combatMapMetersPerUnit(svg)), "30");
});

test("ensureCombatMapMetersPerUnit persists inferred scale on legacy maps", () => {
  const legacy = `<svg viewBox="0 0 800 500"><rect x="0" y="0" width="800" height="500" type="bounding_box"/></svg>`;
  assert.equal(readSvgMetersPerUnit(legacy), null);
  const next = ensureCombatMapMetersPerUnit(legacy);
  assert.equal(readSvgMetersPerUnit(next), 0.125);
});

test("svg and meter fields roundtrip", () => {
  const mpu = combatMapMetersPerUnit(createDefaultCombatMapSvg());
  const units = meterFieldToSvgLength("10", mpu);
  assert.ok(units);
  assert.equal(svgLengthToMeterField(units!, mpu), "10");
});

test("mapSizeLabelMeters shows meter dimensions", () => {
  const label = mapSizeLabelMeters(createDefaultCombatMapSvg());
  assert.equal(label, "20×20 m");
});

test("formatMapMeters rounds to one decimal", () => {
  assert.equal(formatMapMeters(12.04), "12");
  assert.equal(formatMapMeters(12.06), "12.1");
});

test("metersToSvgUnits inverts svgUnitsToMeters", () => {
  const mpu = 0.125;
  assert.equal(metersToSvgUnits(svgUnitsToMeters(40, mpu), mpu), 40);
});
