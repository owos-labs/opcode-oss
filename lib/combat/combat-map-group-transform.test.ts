import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCombatMapSvg,
  insertCombatMapRect,
  parseCombatMapElements,
} from "./combat-map-document.ts";
import { updateCombatMapElementRotation } from "./combat-map-rotate.ts";
import {
  pickGroupCornerInteraction,
  resizeCombatMapSelection,
  rotateCombatMapSelection,
  selectionGroupBounds,
  transformableSelectionIds,
} from "./combat-map-group-transform.ts";

function twoWallSvg() {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 40,
    height: 2,
  });
  svg = insertCombatMapRect(svg, {
    kind: "barrier",
    id: "wall-1",
    name: "wall-1",
    x: 60,
    y: 20,
    width: 20,
    height: 2,
  });
  return svg;
}

test("selectionGroupBounds unions transformable selection", () => {
  const elements = parseCombatMapElements(twoWallSvg());
  const ids = transformableSelectionIds(elements, ["wall-0", "wall-1", "bounds"]);
  assert.deepEqual(ids, ["wall-0", "wall-1"]);
  const group = selectionGroupBounds(elements, ["wall-0", "wall-1"]);
  assert.deepEqual(group, { x: 10, y: 20, width: 70, height: 2.5 });
});

test("resizeCombatMapSelection scales every selected wall", () => {
  const originSvg = twoWallSvg();
  const elements = parseCombatMapElements(originSvg);
  const group = selectionGroupBounds(elements, ["wall-0", "wall-1"])!;
  const next = resizeCombatMapSelection(originSvg, ["wall-0", "wall-1"], group, "se", {
    x: group.x + group.width * 2,
    y: group.y + group.height * 2,
  });
  const walls = parseCombatMapElements(next);
  const w0 = walls.find((el) => el.id === "wall-0");
  const w1 = walls.find((el) => el.id === "wall-1");
  assert.equal(Number(w0?.attrs.width), 80);
  assert.equal(Number(w1?.attrs.width), 40);
});

test("rotateCombatMapSelection rotates selected walls around group center", () => {
  const originSvg = twoWallSvg();
  const elements = parseCombatMapElements(originSvg);
  const group = selectionGroupBounds(elements, ["wall-0", "wall-1"])!;
  const pivot = { x: group.x + group.width / 2, y: group.y + group.height / 2 };
  const next = rotateCombatMapSelection(originSvg, ["wall-0", "wall-1"], pivot, 90);
  const w0 = parseCombatMapElements(next).find((el) => el.id === "wall-0");
  assert.match(w0?.attrs.transform ?? "", /rotate\(90/);
});

test("pickGroupCornerInteraction finds rotate ring on group bounds", () => {
  const group = { x: 10, y: 20, width: 70, height: 2.5 };
  const hit = pickGroupCornerInteraction(group, { x: 4, y: 14 }, 1);
  assert.equal(hit?.kind, "rotate");
});

test("resizeCombatMapSelection scales rotated walls in the group", () => {
  let svg = twoWallSvg();
  svg = updateCombatMapElementRotation(svg, "wall-0", 45);
  const elements = parseCombatMapElements(svg);
  const group = selectionGroupBounds(elements, ["wall-0", "wall-1"])!;
  const next = resizeCombatMapSelection(svg, ["wall-0", "wall-1"], group, "se", {
    x: group.x + group.width * 2,
    y: group.y + group.height * 2,
  });
  const wall = parseCombatMapElements(next).find((el) => el.id === "wall-0");
  assert.match(wall?.attrs.transform ?? "", /rotate\(45/);
  assert.ok(Number(wall?.attrs.width) > 40);
});
