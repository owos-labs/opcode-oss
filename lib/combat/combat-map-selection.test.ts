import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCombatMapSvg,
  insertCombatMapRect,
  parseCombatMapElements,
} from "./combat-map-document.ts";
import {
  boundsFromTwoPoints,
  boundsIntersect,
  clickSelectIds,
  moveCombatMapSelection,
  primarySelectionId,
  selectIdsForPointerDown,
  selectIdsInMarquee,
} from "./combat-map-selection.ts";

test("clickSelectIds replaces or toggles selection", () => {
  assert.deepEqual(clickSelectIds([], "a", false), ["a"]);
  assert.deepEqual(clickSelectIds(["a", "b"], "c", false), ["c"]);
  assert.deepEqual(clickSelectIds(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(clickSelectIds(["a", "b"], "a", true), ["b"]);
});

test("selectIdsForPointerDown keeps multi-select when dragging a selected item", () => {
  assert.deepEqual(selectIdsForPointerDown(["a", "b"], "a", false), ["a", "b"]);
  assert.deepEqual(selectIdsForPointerDown(["a", "b"], "c", false), ["c"]);
  assert.deepEqual(selectIdsForPointerDown(["a"], "a", false), ["a"]);
});

test("primarySelectionId returns the last picked id", () => {
  assert.equal(primarySelectionId([]), null);
  assert.equal(primarySelectionId(["a", "b"]), "b");
});

test("moveCombatMapSelection moves every selected shape except bounds", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 30,
    height: 10,
  });
  svg = insertCombatMapRect(svg, {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 50,
    y: 40,
    width: 20,
    height: 20,
  });
  const next = moveCombatMapSelection(svg, ["wall-0", "room-0"], "wall-0", 5, -3);
  const wall = parseCombatMapElements(next).find((el) => el.id === "wall-0");
  const room = parseCombatMapElements(next).find((el) => el.id === "room-0");
  assert.equal(wall?.attrs.x, "15");
  assert.equal(wall?.attrs.y, "17");
  assert.equal(room?.attrs.x, "55");
  assert.equal(room?.attrs.y, "37");
});

test("selectIdsInMarquee picks intersecting map elements", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 30,
    height: 10,
  });
  svg = insertCombatMapRect(svg, {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 80,
    y: 80,
    width: 20,
    height: 20,
  });
  const elements = parseCombatMapElements(svg);
  const rect = boundsFromTwoPoints(0, 0, 50, 50);
  assert.deepEqual(selectIdsInMarquee(elements, rect, [], false), ["wall-0"]);
  assert.deepEqual(selectIdsInMarquee(elements, rect, ["room-0"], true), ["room-0", "wall-0"]);
});

test("boundsIntersect detects overlapping boxes", () => {
  assert.equal(
    boundsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
    ),
    true,
  );
  assert.equal(
    boundsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    ),
    false,
  );
});

test("moveCombatMapSelection dragging bounds moves the whole map once", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 30,
    height: 10,
  });
  const next = moveCombatMapSelection(svg, ["bounds", "wall-0"], "bounds", 4, 2);
  const bounds = parseCombatMapElements(next).find((el) => el.id === "bounds");
  const wall = parseCombatMapElements(next).find((el) => el.id === "wall-0");
  assert.equal(bounds?.attrs.x, "4");
  assert.equal(bounds?.attrs.y, "2");
  assert.equal(wall?.attrs.x, "14");
  assert.equal(wall?.attrs.y, "22");
});
