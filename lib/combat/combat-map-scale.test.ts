import assert from "node:assert/strict";
import test from "node:test";

import { insertCombatMapRect, parseCombatMapElements } from "./combat-map-document.ts";
import { createDefaultCombatMapSvg } from "./combat-map-document.ts";
import { combatMapElementBounds } from "./combat-map-element-geometry.ts";
import {
  boundsFromHandleDrag,
  patchElementToBounds,
  resizeCombatMapElement,
  resizeCombatMapRectIgnoringRotation,
  scaleHandlePositions,
  scaleHandleScreenCursor,
} from "./combat-map-scale.ts";
import { updateCombatMapElementRotation } from "./combat-map-rotate.ts";

test("boundsFromHandleDrag expands from southeast handle", () => {
  const origin = { x: 10, y: 20, width: 30, height: 40 };
  const next = boundsFromHandleDrag(origin, "se", { x: 50, y: 70 });
  assert.deepEqual(next, { x: 10, y: 20, width: 40, height: 50 });
});

test("resizeCombatMapElement scales bounding_box and syncs viewBox", () => {
  const bounds = parseCombatMapElements(createDefaultCombatMapSvg()).find((e) => e.kind === "bounding_box");
  assert.ok(bounds);
  const next = resizeCombatMapElement(createDefaultCombatMapSvg(), bounds!.id, {
    x: 0,
    y: 0,
    width: 900,
    height: 560,
  });
  const box = parseCombatMapElements(next).find((e) => e.id === bounds!.id);
  assert.equal(box?.attrs.width, "900");
  assert.match(next, /viewBox="0 0 900 560"/);
});

test("resizeCombatMapElement scales rect width and height", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 0,
    y: 0,
    width: 20,
    height: 10,
  });
  const next = resizeCombatMapElement(svg, "wall-0", { x: 0, y: 0, width: 40, height: 15 });
  const wall = parseCombatMapElements(next).find((e) => e.id === "wall-0");
  assert.equal(wall?.attrs.width, "40");
  assert.equal(wall?.attrs.height, "15");
});

test("scaleHandleScreenCursor swaps edge cursors on a 90° wall", () => {
  const svg = updateCombatMapElementRotation(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "barrier",
      id: "wall-0",
      name: "wall-0",
      x: 10,
      y: 20,
      width: 40,
      height: 2,
    }),
    "wall-0",
    90,
  );
  const wall = parseCombatMapElements(svg).find((entry) => entry.id === "wall-0")!;
  const aabb = combatMapElementBounds(wall);
  assert.ok(aabb);
  const handles = scaleHandlePositions(aabb);
  const viewBox = { x: 0, y: 0, w: 100, h: 100 };
  const pan = { x: 0, y: 0 };
  assert.equal(scaleHandleScreenCursor(handles, "n", viewBox, pan, 1), "ns-resize");
  assert.equal(scaleHandleScreenCursor(handles, "e", viewBox, pan, 1), "ew-resize");
});

test("resizeCombatMapRectIgnoringRotation scales AABB and clears rotation", () => {
  const svg = updateCombatMapElementRotation(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "barrier",
      id: "wall-0",
      name: "wall-0",
      x: 10,
      y: 20,
      width: 40,
      height: 2,
    }),
    "wall-0",
    90,
  );
  const wall = parseCombatMapElements(svg).find((entry) => entry.id === "wall-0")!;
  const aabb = combatMapElementBounds(wall)!;
  const next = resizeCombatMapRectIgnoringRotation(svg, "wall-0", aabb, "se", {
    x: aabb.x + aabb.width + 10,
    y: aabb.y + aabb.height + 10,
  });
  const scaled = parseCombatMapElements(next).find((entry) => entry.id === "wall-0")!;
  assert.equal(scaled.attrs.transform, undefined);
  assert.ok(Number(scaled.attrs.width) > aabb.width - 1);
});

test("patchElementToBounds scales path points with bbox", () => {
  const el = parseCombatMapElements(
    `<svg viewBox="0 0 100 100"><path name="p" type="barrier" d="M0 0L10 0L10 10Z"/></svg>`,
  )[0]!;
  const patch = patchElementToBounds(el, { x: 0, y: 0, width: 20, height: 20 });
  assert.match(patch.d ?? "", /L20 0/);
  assert.match(patch.d ?? "", /L20 20/);
});
