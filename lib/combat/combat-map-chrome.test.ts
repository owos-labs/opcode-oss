import assert from "node:assert/strict";
import test from "node:test";

import {
  combatMapBoundsStroke,
  combatMapEditorChrome,
  fillRelativeLuminance,
  isDarkMapFill,
} from "./combat-map-chrome.ts";

test("isDarkMapFill detects dark fills", () => {
  assert.equal(isDarkMapFill("#000000"), true);
  assert.equal(isDarkMapFill("#111111"), true);
  assert.equal(isDarkMapFill("#ffffff"), false);
  assert.equal(isDarkMapFill("#f5f5f5"), false);
});

test("combatMapBoundsStroke prefers explicit bounds stroke", () => {
  const chrome = combatMapEditorChrome("#ffffff");
  assert.equal(combatMapBoundsStroke({ attrs: { stroke: "#00ff00" } }, chrome), "#00ff00");
  assert.equal(combatMapBoundsStroke({ attrs: {} }, chrome), chrome.boundsStroke);
});

test("combatMapEditorChrome softens grid and bounds on dark maps", () => {
  const dark = combatMapEditorChrome("#0f0f0f");
  const light = combatMapEditorChrome("#ffffff");
  assert.match(dark.gridMinor, /rgba\(255,255,255,/);
  assert.match(light.gridMinor, /rgba\(15,23,42,/);
  assert.ok(fillRelativeLuminance("#ffffff")! > fillRelativeLuminance("#0f0f0f")!);
  assert.equal(dark.boundsStrokeWidth, "1px");
});
