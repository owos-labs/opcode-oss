import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCombatMapSvg,
  insertCombatMapRect,
  parseCombatMapElements,
} from "./combat-map-document.ts";
import {
  collectRoomLabels,
  formatRoomDimensionsLabel,
  roomLabelChrome,
  shouldShowRoomLabels,
} from "./combat-map-room-labels.ts";

test("shouldShowRoomLabels uses overlay label zoom threshold", () => {
  assert.equal(shouldShowRoomLabels(2.9), false);
  assert.equal(shouldShowRoomLabels(3), true);
});

test("formatRoomDimensionsLabel renders WxH in meters", () => {
  assert.equal(formatRoomDimensionsLabel(500, 250, 0.02), "10×5米");
});

test("roomLabelChrome includes name and size label", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 0,
    y: 0,
    width: 500,
    height: 250,
  });
  const el = parseCombatMapElements(svg).find((entry) => entry.id === "room-0")!;
  el.attrs.name = "Hall";
  const chrome = roomLabelChrome(el, 0.02)!;
  assert.equal(chrome.name, "Hall");
  assert.equal(chrome.sizeLabel, "10×5米");
});

test("collectRoomLabels skips non-room elements", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  svg = insertCombatMapRect(svg, {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 10,
    width: 20,
    height: 2,
  });
  const labels = collectRoomLabels(parseCombatMapElements(svg), 0.02);
  assert.deepEqual(labels.map((entry) => entry.id), ["room-0"]);
});
