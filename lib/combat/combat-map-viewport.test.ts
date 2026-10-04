import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultCombatMapSvg } from "./combat-map-document.ts";
import {
  centerPanOnSvgPoint,
  combatMapArtboardRect,
  fitCombatMapArtboard,
  fitCombatMapToViewport,
  fitMapFrameToViewport,
  combatMapHandleSizeMapUnits,
  combatMapScreenHandleRect,
  mapDeltaFromClientDrag,
  mapPointFromClientDrag,
  combatMapBoundsToScreenRect,
  combatMapSnapGuideScreenSegment,
  formatCombatMapZoomPercent,
  mapSvgToScreen,
  svgPointAtClient,
  svgPointAtClientInFrame,
  visibleMapSvgRect,
} from "./combat-map-viewport.ts";

test("formatCombatMapZoomPercent shows rounded percent", () => {
  assert.equal(formatCombatMapZoomPercent(1), "100%");
  assert.equal(formatCombatMapZoomPercent(1.5), "150%");
  assert.equal(formatCombatMapZoomPercent(0.05), "5.0%");
  assert.equal(formatCombatMapZoomPercent(0), "—");
});

test("mapDeltaFromClientDrag converts screen drag to map units", () => {
  const { dx, dy } = mapDeltaFromClientDrag(120, 140, 100, 100, 2);
  assert.equal(dx, 10);
  assert.equal(dy, 20);
});

test("mapPointFromClientDrag offsets from a fixed origin", () => {
  const pt = mapPointFromClientDrag({ x: 5, y: 8 }, 110, 120, 100, 100, 2);
  assert.deepEqual(pt, { x: 10, y: 18 });
});

test("svgPointAtClient inverts bench pan/scale", () => {
  const rect = { left: 10, top: 20, width: 400, height: 300 } as DOMRect;
  const pt = svgPointAtClient(110, 120, rect, { x: 50, y: 30 }, 2);
  assert.equal(pt.x, 25);
  assert.equal(pt.y, 35);
});

test("centerPanOnSvgPoint moves svg point to viewport center", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 } as DOMRect;
  const next = centerPanOnSvgPoint(50, 25, rect, { x: 0, y: 0 }, 1);
  assert.equal(next.x, 50);
  assert.equal(next.y, 25);
});

test("fitCombatMapToViewport scales down and centers oversized maps", () => {
  const { pan, scale } = fitCombatMapToViewport(
    { w: 1000, h: 800 },
    { width: 500, height: 400 },
    0,
  );
  assert.equal(scale, 0.5);
  assert.equal(pan.x, 0);
  assert.equal(pan.y, 0);
});

test("fitCombatMapToViewport leaves small maps at 1×", () => {
  const { pan, scale } = fitCombatMapToViewport({ w: 400, h: 300 }, { width: 800, height: 600 });
  assert.equal(scale, 1);
  assert.equal(pan.x, 200);
  assert.equal(pan.y, 150);
});

test("combatMapArtboardRect reads bounding_box dimensions", () => {
  const rect = combatMapArtboardRect(createDefaultCombatMapSvg(), { x: 0, y: 0, w: 1000, h: 1000 });
  assert.equal(rect.x, 0);
  assert.equal(rect.w, 1000);
  assert.equal(rect.h, 1000);
});

test("fitCombatMapArtboard can upscale when maxScale allows", () => {
  const { pan, scale } = fitCombatMapArtboard(
    { x: 0, y: 0, w: 800, h: 500 },
    { width: 1200, height: 900 },
    { top: 80, right: 320, bottom: 96, left: 24 },
    4,
  );
  assert.ok(scale > 1);
  assert.ok(pan.x >= 24);
  assert.ok(pan.y >= 80);
});

test("fitCombatMapArtboard keeps 1× for small maps when maxScale is 1", () => {
  const { scale } = fitCombatMapArtboard(
    { x: 0, y: 0, w: 800, h: 500 },
    { width: 1200, height: 900 },
    { top: 64, right: 24, bottom: 88, left: 24 },
    1,
  );
  assert.equal(scale, 1);
});

test("fitMapFrameToViewport centers the bounding box frame", () => {
  const { pan, scale } = fitMapFrameToViewport(
    { w: 800, h: 500 },
    { width: 900, height: 700 },
    { top: 64, right: 24, bottom: 88, left: 24 },
    1,
  );
  assert.equal(scale, 1);
  assert.equal(pan.x, 24 + (900 - 24 - 24 - 800) / 2);
});

test("svgPointAtClientInFrame maps through bounding box offset", () => {
  const rect = { left: 0, top: 0, width: 900, height: 700 } as DOMRect;
  const pt = svgPointAtClientInFrame(124, 164, rect, { x: 50, y: 50 }, 1, {
    x: 0.5,
    y: 0.5,
    w: 799,
    h: 499,
  });
  assert.equal(pt.x, 74.5);
  assert.equal(pt.y, 114.5);
});

test("mapSvgToScreen and visibleMapSvgRect track pan and zoom", () => {
  const viewBox = { x: 0, y: 0, w: 200, h: 500 };
  const pan = { x: 40, y: 30 };
  const scale = 2;
  assert.deepEqual(mapSvgToScreen(10, 20, viewBox, pan, scale), { x: 60, y: 70 });
  const visible = visibleMapSvgRect(viewBox, pan, scale, { width: 300, height: 200 });
  assert.equal(visible.minX, -20);
  assert.equal(visible.maxX, 130);
  assert.equal(visible.minY, -15);
  assert.equal(visible.maxY, 85);
});

test("combatMapBoundsToScreenRect tracks pan and zoom in screen space", () => {
  const viewBox = { x: 0, y: 0, w: 200, h: 200 };
  const pan = { x: 40, y: 30 };
  const scale = 2;
  const rect = combatMapBoundsToScreenRect({ x: 10, y: 20, width: 30, height: 40 }, viewBox, pan, scale);
  assert.deepEqual(rect, { x: 60, y: 70, width: 60, height: 80 });
});

test("combatMapHandleSizeMapUnits keeps ~4px on screen at any zoom", () => {
  assert.equal(combatMapHandleSizeMapUnits({ width: 1000, height: 800 }, 1), 4);
  assert.equal(combatMapHandleSizeMapUnits({ width: 1000, height: 800 }, 2), 2);
  assert.equal(combatMapHandleSizeMapUnits({ width: 200, height: 100 }, 4), 1);
});

test("combatMapScreenHandleRect stays 4px on screen at any zoom", () => {
  const viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
  const atOne = combatMapScreenHandleRect(100, 200, viewBox, { x: 0, y: 0 }, 1);
  assert.deepEqual(atOne, { x: 98, y: 198, width: 4, height: 4 });
  const zoomed = combatMapScreenHandleRect(100, 200, viewBox, { x: 10, y: 20 }, 3);
  assert.deepEqual(zoomed, { x: 308, y: 618, width: 4, height: 4 });
});

test("combatMapSnapGuideScreenSegment spans viewport in screen px", () => {
  const viewBox = { x: 0, y: 0, w: 200, h: 200 };
  const pan = { x: 40, y: 30 };
  const scale = 2;
  const viewport = { width: 300, height: 200 };
  assert.deepEqual(
    combatMapSnapGuideScreenSegment({ axis: "x", value: 10 }, viewBox, pan, scale, viewport),
    { x1: 60, y1: 0, x2: 60, y2: 200 },
  );
  assert.deepEqual(
    combatMapSnapGuideScreenSegment({ axis: "y", value: 20 }, viewBox, pan, scale, viewport),
    { x1: 0, y1: 70, x2: 300, y2: 70 },
  );
});
