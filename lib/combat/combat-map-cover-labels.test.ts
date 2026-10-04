import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCombatMapSvg,
  insertCombatMapRect,
  parseCombatMapElements,
} from "./combat-map-document.ts";
import {
  collectConcealmentCoverLabels,
  combatMapOverlayCenterFontSize,
  combatMapOverlayLabelText,
  concealmentCoverLabelChrome,
  concealmentCoverLabelTransform,
  shouldShowConcealmentCoverLabels,
} from "./combat-map-cover-labels.ts";
import { updateCombatMapElementRotation } from "./combat-map-rotate.ts";

test("shouldShowConcealmentCoverLabels follows 0.5m grid zoom threshold", () => {
  assert.equal(shouldShowConcealmentCoverLabels(2.9), false);
  assert.equal(shouldShowConcealmentCoverLabels(3), true);
});

test("concealmentCoverLabelChrome maps corners and center for rects", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "crate-0",
    name: "crate-0",
    x: 10,
    y: 20,
    width: 40,
    height: 20,
  });
  const el = parseCombatMapElements(svg).find((entry) => entry.id === "crate-0")!;
  el.attrs.ar = "15";
  el.attrs.ssp = "123";
  el.attrs.name = "Crate";
  const chrome = concealmentCoverLabelChrome(el, 0.02)!;
  assert.deepEqual(chrome.localBounds, { x: 10, y: 20, width: 40, height: 20 });
  assert.equal(chrome.rotationDeg, 0);
  assert.equal(chrome.ssp, "123");
  assert.equal(chrome.ar, "15");
  assert.equal(chrome.name, "Crate");
  assert.equal(chrome.sizeLabel, "0.8×0.4米");
  assert.equal(concealmentCoverLabelTransform(chrome), undefined);
});

test("concealmentCoverLabelChrome keeps local bounds and rotation for rotated rects", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "crate-rot",
    name: "crate-rot",
    x: 10,
    y: 20,
    width: 40,
    height: 20,
  });
  svg = updateCombatMapElementRotation(svg, "crate-rot", 90);
  const el = parseCombatMapElements(svg).find((entry) => entry.id === "crate-rot")!;
  const chrome = concealmentCoverLabelChrome(el, 0.02)!;
  assert.deepEqual(chrome.localBounds, { x: 10, y: 20, width: 40, height: 20 });
  assert.equal(chrome.rotationDeg, 90);
  assert.match(concealmentCoverLabelTransform(chrome) ?? "", /rotate\(90 30 30\)/);
});

test("combatMapOverlayLabelText uppercases overlay labels", () => {
  assert.equal(combatMapOverlayLabelText("cover-3"), "COVER-3");
});

test("combatMapOverlayCenterFontSize fits size label inside rect bounds", () => {
  const bounds = { x: 0, y: 0, width: 10.4, height: 10.7 };
  const size = combatMapOverlayCenterFontSize(bounds, 3, "0.2×0.2米");
  assert.ok(size > 0);
  assert.ok(size <= 10 / 3);
});

test("collectConcealmentCoverLabels skips walls and rooms", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  svg = insertCombatMapRect(svg, {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 20,
    y: 0,
    width: 10,
    height: 10,
  });
  const labels = collectConcealmentCoverLabels(parseCombatMapElements(svg), 0.02);
  assert.deepEqual(labels.map((entry) => entry.id), ["cover-0"]);
});
