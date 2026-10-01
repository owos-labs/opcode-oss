import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCombatMap } from "./map-adapter/compile.ts";
import type { MapSegmentDto } from "./map-adapter/types.ts";
import {
  buildEncounterNav,
  buildHuntPatrolRoute,
  canSeeRoomInterior,
  huntWipeComplete,
  shouldRebuildRooms,
} from "./patrol.ts";

function mapFromWalls(id: string, walls: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>) {
  const segments: MapSegmentDto[] = walls.map((w, i) => ({
    id: `w${i}`,
    a: w.a,
    b: w.b,
    armorRating: 10,
    maxSsp: 10,
    currentSsp: 10,
    blocksVision: true,
  }));
  return compileCombatMap({ id, segments });
}

function twoRoomMap() {
  return mapFromWalls("pair", [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 8 } },
    { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } },
    { a: { x: 0, y: 8 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 8, y: 3 } },
    { a: { x: 8, y: 5 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 16, y: 0 } },
    { a: { x: 8, y: 8 }, b: { x: 16, y: 8 } },
    { a: { x: 16, y: 0 }, b: { x: 16, y: 8 } },
  ]);
}

test("canSeeRoomInterior is true from the doorway, not only the centroid", () => {
  const room = { id: "rect-40", centroid: { x: 8, y: 2 }, cells: [{ x: 8, y: 2 }, { x: 7, y: 2 }] };
  assert.equal(canSeeRoomInterior({ x: 0, y: 2 }, room, []), true);
  assert.equal(
    canSeeRoomInterior({ x: 0, y: 2 }, room, [{ a: { x: 4, y: -2 }, b: { x: 4, y: 6 } }]),
    false,
  );
});

test("shouldRebuildRooms is true only at encounter start and patrol end", () => {
  assert.equal(shouldRebuildRooms("patrol-end"), true);
  assert.equal(shouldRebuildRooms("encounter-start"), true);
  assert.equal(shouldRebuildRooms("shot-through-cover"), false);
});

test("hunt professional route visits every room centroid", () => {
  const nav = buildEncounterNav(twoRoomMap(), { pockets: true });
  assert.ok(nav.rooms.length >= 2);
  const route = buildHuntPatrolRoute({
    nav,
    origin: { x: 1, y: 1 },
    difficulty: "professional",
  });
  const visited = new Set(route.waypoints.filter((w) => w.roomId).map((w) => w.roomId));
  for (const room of nav.rooms) {
    assert.ok(visited.has(room.id), `missing room ${room.id}`);
    assert.ok(
      route.waypoints.some(
        (w) => Math.hypot(w.position.x - room.centroid.x, w.position.y - room.centroid.y) < 1e-6,
      ),
    );
  }
});

test("hunt wipe helper: zero hostiles remaining completes the mission", () => {
  assert.equal(huntWipeComplete(0), true);
  assert.equal(huntWipeComplete(1), false);
  assert.equal(huntWipeComplete(3), false);
});

test("hunt trained route emits opposite then random then opposite", () => {
  const nav = buildEncounterNav(twoRoomMap(), { pockets: true });
  const route = buildHuntPatrolRoute({
    nav,
    origin: { x: 1, y: 1 },
    difficulty: "trained",
    rng: () => 0.25,
  });
  const roles = route.waypoints.map((w) => w.role);
  assert.equal(roles.filter((r) => r === "opposite").length, 2);
  assert.equal(roles.filter((r) => r === "random").length, 1);
  assert.ok(roles.indexOf("opposite") < roles.indexOf("random"));
  assert.ok(roles.lastIndexOf("opposite") > roles.indexOf("random"));
});

test("hunt expert route visits a corner then the nearest next corner", () => {
  const nav = buildEncounterNav(twoRoomMap(), { pockets: true });
  const route = buildHuntPatrolRoute({
    nav,
    origin: { x: 1, y: 1 },
    difficulty: "expert",
    rng: () => 0.9,
  });
  const corners = route.waypoints.filter((w) => w.role === "corner");
  assert.equal(corners.length, 2);
  const first = corners[0]!.position;
  assert.ok(Math.hypot(first.x - nav.bounds.min.x, first.y - nav.bounds.min.y) < 1e-6);
});
