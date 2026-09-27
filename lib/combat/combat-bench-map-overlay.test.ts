import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatBenchMapOverlay,
  pointWithinMovBudget,
  raySegmentHitT,
  visibilityPolygonMeters,
} from "./combat-bench-map-overlay.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";

test("raySegmentHitT finds wall along +x ray", () => {
  const t = raySegmentHitT({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: -1 }, { x: 3, y: 1 });
  assert.ok(t !== null);
  assert.ok(Math.abs(t! - 3) < 1e-6);
});

test("visibilityPolygonMeters is shorter through a blocking wall", () => {
  const walls = [{ a: { x: 2, y: -5 }, b: { x: 2, y: 5 } }];
  const poly = visibilityPolygonMeters({
    origin: { x: 0, y: 0 },
    walls,
    maxRangeM: 10,
    rayCount: 360,
  });
  const east = poly.find((p) => Math.abs(p.y) < 0.05 && p.x > 0);
  assert.ok(east);
  assert.ok(east!.x < 2.05);
  assert.ok(east!.x > 1.9);
});

test("buildCombatBenchMapOverlay movement disk matches mov budget radius", () => {
  const map: CompiledCombatMap = {
    mapId: "t",
    walls: [],
    barriers: [],
    emplacements: [],
  };
  const overlay = buildCombatBenchMapOverlay({
    map,
    origin: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    visionRangeM: 20,
  });
  assert.equal(overlay.movBudgetM, 15);
  assert.ok(overlay.movementDisk.length >= 8);
  assert.ok(
    overlay.movementDisk.every((p) => Math.hypot(p.x, p.y) <= 15 + 1e-3),
  );
  assert.ok(overlay.visibility.length >= 8);
});

test("pointWithinMovBudget is euclidean only", () => {
  assert.equal(pointWithinMovBudget({ x: 0, y: 0 }, { x: 3, y: 4 }, 10, 0), true);
  assert.equal(pointWithinMovBudget({ x: 0, y: 0 }, { x: 16, y: 0 }, 10, 0), false);
});
