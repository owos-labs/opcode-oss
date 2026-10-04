import assert from "node:assert/strict";
import test from "node:test";

import {
  combatDrawToolActive,
  gridSnapEnabledForElementKind,
  isCombatDrawRectLargeEnough,
  isCombatMapGroupKeyDown,
  isCombatMapHelpKeyDown,
  isCombatMapUndoKeyDown,
  isCombatMapUngroupKeyDown,
  isMarqueeSelectModifier,
  minCombatDrawRectSizeSvg,
} from "./combat-map-editor-input.ts";

test("minCombatDrawRectSizeSvg allows 0.05 m walls at default scale", () => {
  const mpu = 0.02;
  const minWall = minCombatDrawRectSizeSvg(mpu, "barrier");
  assert.equal(minWall, 2.5);
  assert.equal(isCombatDrawRectLargeEnough(5, 2.5, mpu, "barrier"), true);
  assert.equal(isCombatDrawRectLargeEnough(5, 2.4, mpu, "barrier"), false);
});

test("minCombatDrawRectSizeSvg keeps rooms slightly larger", () => {
  const mpu = 0.02;
  assert.equal(minCombatDrawRectSizeSvg(mpu, "room"), 5);
  assert.equal(isCombatDrawRectLargeEnough(5, 5, mpu, "room"), true);
  assert.equal(isCombatDrawRectLargeEnough(4, 5, mpu, "room"), false);
});

test("combatDrawToolActive pauses draw mode while space pan is held", () => {
  assert.equal(combatDrawToolActive("barrier", false), true);
  assert.equal(combatDrawToolActive("barrier", true), false);
  assert.equal(combatDrawToolActive("select", true), false);
});

test("gridSnapEnabledForElementKind skips thin cover geometry", () => {
  assert.equal(gridSnapEnabledForElementKind("barrier"), false);
  assert.equal(gridSnapEnabledForElementKind("concealment"), false);
  assert.equal(gridSnapEnabledForElementKind("room"), true);
});

test("isMarqueeSelectModifier accepts ctrl or meta", () => {
  assert.equal(isMarqueeSelectModifier({ ctrlKey: true, metaKey: false }), true);
  assert.equal(isMarqueeSelectModifier({ ctrlKey: false, metaKey: true }), true);
  assert.equal(isMarqueeSelectModifier({ ctrlKey: false, metaKey: false }), false);
});

test("isCombatMapGroupKeyDown and isCombatMapUngroupKeyDown", () => {
  assert.equal(isCombatMapGroupKeyDown({ code: "KeyG", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false), true);
  assert.equal(isCombatMapGroupKeyDown({ code: "KeyG", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, false), false);
  assert.equal(isCombatMapUngroupKeyDown({ code: "Backspace", key: "Backspace", ctrlKey: true, metaKey: false }, false), true);
  assert.equal(isCombatMapUngroupKeyDown({ code: "Backspace", key: "Backspace", ctrlKey: false, metaKey: false }, false), false);
});

test("isCombatMapHelpKeyDown opens help on question mark", () => {
  assert.equal(isCombatMapHelpKeyDown({ key: "?", ctrlKey: false, metaKey: false, altKey: false }, false), true);
  assert.equal(isCombatMapHelpKeyDown({ key: "?", ctrlKey: true, metaKey: false, altKey: false }, false), false);
  assert.equal(isCombatMapHelpKeyDown({ key: "?", ctrlKey: false, metaKey: false, altKey: false }, true), false);
});

test("isCombatMapUndoKeyDown maps ctrl+z and ctrl+shift+z", () => {
  assert.equal(isCombatMapUndoKeyDown({ code: "KeyZ", ctrlKey: true, metaKey: false, shiftKey: false }, false), "undo");
  assert.equal(isCombatMapUndoKeyDown({ code: "KeyZ", ctrlKey: true, metaKey: false, shiftKey: true }, false), "redo");
  assert.equal(isCombatMapUndoKeyDown({ code: "KeyZ", ctrlKey: false, metaKey: true, shiftKey: false }, false), "undo");
  assert.equal(isCombatMapUndoKeyDown({ code: "KeyZ", ctrlKey: true, metaKey: false, shiftKey: false }, true), null);
});
