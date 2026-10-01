import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatBenchEffectLines,
  buildCombatBenchMapOverlay,
  buildCombatBenchUnitVisions,
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
  assert.equal(overlay.movBudgetM, 10);
  assert.ok(overlay.movementDisk.length >= 8);
  assert.ok(
    overlay.movementDisk.every((p) => Math.hypot(p.x, p.y) <= 10 + 1e-3),
  );
  assert.ok(overlay.visibility.length >= 8);
});

test("buildCombatBenchMapOverlay movement disk stops at a long wall", () => {
  const overlay = buildCombatBenchMapOverlay({
    map: {
      mapId: "t",
      walls: [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }],
      barriers: [],
      emplacements: [],
    },
    origin: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    visionRangeM: 20,
  });
  assert.ok(overlay.movementDisk.length >= 3);
  assert.ok(overlay.movementDisk.every((p) => p.x < 2.05));
});

test("pointWithinMovBudget uses walked path around walls", () => {
  assert.equal(pointWithinMovBudget({ x: 0, y: 0 }, { x: 3, y: 4 }, 10, 0), true);
  assert.equal(pointWithinMovBudget({ x: 0, y: 0 }, { x: 16, y: 0 }, 10, 0), false);
  const wall = [{ a: { x: 2, y: -20 }, b: { x: 2, y: 20 } }];
  assert.equal(pointWithinMovBudget({ x: 0, y: 0 }, { x: 4, y: 0 }, 10, 0, wall), false);
});

test("buildCombatBenchEffectLines draws mutual LOS between different teams inside V", () => {
  const units = [
    { placementId: "a", team: "hostile", origin: { x: 0, y: 0 }, visionRangeM: 20 },
    { placementId: "b", team: "friendly", origin: { x: 5, y: 0 }, visionRangeM: 20 },
    { placementId: "c", team: "hostile", origin: { x: 1, y: 0 }, visionRangeM: 20 },
  ];
  const lines = buildCombatBenchEffectLines({ walls: [], units });
  assert.equal(lines.length, 2);
  assert.ok(lines.some((line) => line.fromId === "a" && line.toId === "b"));
  assert.ok(lines.some((line) => line.fromId === "b" && line.toId === "c"));
});

test("buildCombatBenchEffectLines skips a wall-blocked pair", () => {
  const lines = buildCombatBenchEffectLines({
    walls: [{ a: { x: 2, y: -5 }, b: { x: 2, y: 5 } }],
    units: [
      { placementId: "a", team: "hostile", origin: { x: 0, y: 0 }, visionRangeM: 20 },
      { placementId: "b", team: "friendly", origin: { x: 5, y: 0 }, visionRangeM: 20 },
    ],
  });
  assert.equal(lines.length, 0);
});

test("buildCombatBenchUnitVisions clips the polygon at a wall", () => {
  const [vision] = buildCombatBenchUnitVisions({
    map: { mapId: "t", walls: [{ a: { x: 2, y: -5 }, b: { x: 2, y: 5 } }], barriers: [], emplacements: [] },
    units: [{ placementId: "a", team: "hostile", origin: { x: 0, y: 0 }, visionRangeM: 10 }],
  });
  assert.ok(vision);
  assert.ok(vision.polygon.length >= 8);
  const east = vision.polygon.find((p) => Math.abs(p.y) < 0.2 && p.x > 0);
  assert.ok(east);
  assert.ok(east!.x < 2.2);
});
