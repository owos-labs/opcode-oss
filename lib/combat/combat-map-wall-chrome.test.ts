import assert from "node:assert/strict";
import test from "node:test";

import { insertCombatMapRect, parseCombatMapElements } from "./combat-map-document.ts";
import { createDefaultCombatMapSvg } from "./combat-map-document.ts";
import { collectCombatMapWallStrokes, wallStrokeColor } from "./combat-map-wall-chrome.ts";

test("collectCombatMapWallStrokes returns rect bounds for walls and covers", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 40,
    height: 2.5,
  });
  svg = insertCombatMapRect(svg, {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 60,
    y: 20,
    width: 20,
    height: 2.5,
  });
  const elements = parseCombatMapElements(svg);
  const strokes = collectCombatMapWallStrokes(elements);
  assert.equal(strokes.length, 2);
  const wall = strokes.find((s) => s.id === "wall-0");
  assert.equal(wall?.tag, "rect");
  assert.equal(wall?.kind, "barrier");
  if (wall?.tag === "rect") {
    assert.equal(wall.width, 40);
    assert.equal(wall.height, 2.5);
    assert.equal(wall.stroke, "#5c5c5c");
  }
});

test("collectCombatMapWallStrokes preserves rect transform", () => {
  const el = parseCombatMapElements(
    `<svg viewBox="0 0 100 100"><rect name="w" type="barrier" x="0" y="0" width="10" height="2" transform="rotate(90 5 1)"/></svg>`,
  )[0]!;
  const [stroke] = collectCombatMapWallStrokes([el]);
  assert.equal(stroke?.tag, "rect");
  if (stroke?.tag === "rect") assert.equal(stroke.transform, "rotate(90 5 1)");
});

test("wallStrokeColor prefers explicit stroke attribute", () => {
  const el = parseCombatMapElements(
    `<svg viewBox="0 0 100 100"><rect name="w" type="barrier" stroke="#112233" x="0" y="0" width="10" height="2"/></svg>`,
  )[0]!;
  assert.equal(wallStrokeColor(el), "#112233");
});
