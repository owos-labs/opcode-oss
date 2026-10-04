import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultCombatMapSvg, insertCombatMapRect, parseCombatMapElements } from "./combat-map-document.ts";
import {
  canRotateCombatMapElement,
  patchRectRotation,
  orientedScaleHandlePositions,
  pickRectCornerInteraction,
  pointerOutsideCorner,
  rectCornerWorldPositions,
  rectElementIsRotated,
  resizeOrientedCombatMapElement,
  rotationDragDegrees,
  selectionOutlineCorners,
  updateCombatMapElementRotation,
} from "./combat-map-rotate.ts";

function wallSvg() {
  return insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 40,
    height: 2,
  });
}

function wallElement(svg = wallSvg()) {
  return parseCombatMapElements(svg).find((el) => el.id === "wall-0")!;
}

test("canRotateCombatMapElement allows walls, cover, and rooms", () => {
  assert.equal(canRotateCombatMapElement(wallElement()), true);
});

test("pickRectCornerInteraction prefers scale on the corner handle", () => {
  const hit = pickRectCornerInteraction(wallElement(), { x: 10, y: 20 }, 1);
  assert.deepEqual(hit, { kind: "scale", handle: "nw" });
});

test("pickRectCornerInteraction detects rotate ring outside the corner", () => {
  const hit = pickRectCornerInteraction(wallElement(), { x: 4, y: 14 }, 1);
  assert.deepEqual(hit, { kind: "rotate", corner: "nw" });
});

test("pickRectCornerInteraction ignores inside-of-shape corner approach", () => {
  const hit = pickRectCornerInteraction(wallElement(), { x: 16, y: 24 }, 1);
  assert.equal(hit, null);
});

test("pointerOutsideCorner checks the outer half-plane", () => {
  assert.equal(pointerOutsideCorner({ x: 4, y: 14 }, { x: 10, y: 20 }, { cx: 30, cy: 21 }), true);
  assert.equal(pointerOutsideCorner({ x: 16, y: 24 }, { x: 10, y: 20 }, { cx: 30, cy: 21 }), false);
});

test("updateCombatMapElementRotation writes transform attribute", () => {
  let svg = wallSvg();
  svg = updateCombatMapElementRotation(svg, "wall-0", 45);
  const wall = wallElement(svg);
  assert.equal(wall.attrs.transform, "rotate(45 30 21.3)");
  assert.equal(rectElementIsRotated(wall), true);
  assert.equal(selectionOutlineCorners(wall)?.length, 4);
});

test("patchRectRotation clears transform near zero degrees", () => {
  const svg = updateCombatMapElementRotation(wallSvg(), "wall-0", 90);
  const wall = wallElement(svg);
  assert.deepEqual(patchRectRotation(wall, 0), { transform: undefined });
});

test("rotationDragDegrees adds pointer delta and snaps with shift", () => {
  assert.equal(rotationDragDegrees(10, 0, 15), 25);
  assert.equal(rotationDragDegrees(10, 0, 22, true), 30);
});

test("pickRectCornerInteraction finds rotate zones on rotated walls", () => {
  const svg = updateCombatMapElementRotation(wallSvg(), "wall-0", 90);
  const wall = wallElement(svg);
  const corner = rectCornerWorldPositions(wall)?.nw;
  assert.ok(corner);
  const pivot = { cx: 30, cy: 21 };
  const outX = corner.x - pivot.cx;
  const outY = corner.y - pivot.cy;
  const len = Math.hypot(outX, outY) || 1;
  const pointer = { x: corner.x + (outX / len) * 10, y: corner.y + (outY / len) * 10 };
  const hit = pickRectCornerInteraction(wall, pointer, 1);
  assert.equal(hit?.kind, "rotate");
});

test("orientedScaleHandlePositions places handles on world corners", () => {
  const svg = updateCombatMapElementRotation(wallSvg(), "wall-0", 90);
  const wall = wallElement(svg);
  const handles = orientedScaleHandlePositions(wall);
  const corner = rectCornerWorldPositions(wall)?.nw;
  assert.ok(handles && corner);
  assert.equal(handles.nw.x, corner.x);
  assert.equal(handles.nw.y, corner.y);
});

test("resizeOrientedCombatMapElement still scales in local space for legacy callers", () => {
  const svg = updateCombatMapElementRotation(wallSvg(), "wall-0", 45);
  const wall = wallElement(svg);
  const handles = orientedScaleHandlePositions(wall)!;
  const next = resizeOrientedCombatMapElement(svg, "wall-0", "se", {
    x: handles.se.x + 20,
    y: handles.se.y + 20,
  });
  const scaled = wallElement(next);
  assert.match(scaled.attrs.transform ?? "", /rotate\(45/);
  assert.ok(Number(scaled.attrs.width) > Number(wall.attrs.width));
});
