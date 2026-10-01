import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCombatMap } from "./map-adapter/compile.ts";
import type { MapSegmentDto } from "./map-adapter/types.ts";
import { combatRoomsFromRings, detectPocketRooms, detectRooms, enclosureWalls, roomsShareCell } from "./rooms.ts";

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

test("open 3-wall U-shape is a room", () => {
  const map = mapFromWalls("u", [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
    { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
    { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  ]);
  const rooms = detectPocketRooms(map);
  assert.ok(rooms.length >= 1, "expected a pocket inside the U");
  assert.equal(detectRooms(map).length, 0);
  const inside = rooms.some((r) => r.centroid.x > 1 && r.centroid.x < 9 && r.centroid.y > 0.5 && r.centroid.y < 8);
  assert.equal(inside, true);
});

test("two adjacent rooms list doorway overlap cells on both room ids", () => {
  const map = mapFromWalls("pair", [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 8 } },
    { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } },
    { a: { x: 0, y: 8 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 8, y: 3 } },
    { a: { x: 8, y: 5 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 16, y: 0 } },
    { a: { x: 8, y: 8 }, b: { x: 16, y: 8 } },
    { a: { x: 16, y: 0 }, b: { x: 16, y: 8 } },
  ]);
  const rooms = detectPocketRooms(map);
  assert.equal(rooms.length, 2);
  const [left, right] = [...rooms].sort((a, b) => a.centroid.x - b.centroid.x);
  assert.ok(left!.centroid.x < 8);
  assert.ok(right!.centroid.x > 8);
  const shared = roomsShareCell(left!, right!);
  assert.ok(shared.length > 0, "doorway strip must belong to both rooms");
  assert.ok(
    shared.some((c) => Math.abs(c.x - 8) < 2 && c.y > 2.5 && c.y < 5.5),
    "shared cells should sit in the door gap",
  );
  const leftIds = new Set(left!.cells.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`));
  const rightIds = new Set(right!.cells.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`));
  const both = [...leftIds].filter((k) => rightIds.has(k));
  assert.ok(both.length > 0);
});

function coverBox(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): MapSegmentDto[] {
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  return corners.map((a, i) => ({
    id: `${id}-e${i}`,
    a,
    b: corners[(i + 1) % 4]!,
    armorRating: 10,
    maxSsp: 10,
    currentSsp: 10,
    blocksVision: true,
    coverHeightBand: "half",
  }));
}

test("a compact cover box alone is not a room", () => {
  const map = compileCombatMap({ id: "crate", segments: coverBox("crate", 2, 2, 4, 4) });
  assert.equal(enclosureWalls(map).length, 0);
  assert.equal(detectRooms(map).length, 0);
});

test("cover furniture inside a U-pocket does not add a second room", () => {
  const walls = [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
    { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
    { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  ];
  const map = compileCombatMap({
    id: "u-cover",
    segments: [
      ...walls.map((w, i) => ({
        id: `w${i}`,
        a: w.a,
        b: w.b,
        armorRating: 10,
        maxSsp: 10,
        currentSsp: 10,
        blocksVision: true,
      })),
      ...coverBox("crate", 3, 3, 3, 3),
    ],
  });
  const rooms = detectPocketRooms(map);
  assert.equal(rooms.length, 1);
  assert.equal(detectRooms(map).length, 0);
  const crateHit = rooms.some((r) =>
    Math.abs(r.centroid.x - 4.5) < 0.6 && Math.abs(r.centroid.y - 4.5) < 0.6 && r.cells.length <= 12,
  );
  assert.equal(crateHit, false);
});

test("detectRooms uses authored yellow rooms and skips pocket flood", () => {
  const map = mapFromWalls("u", [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
    { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
    { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  ]);
  const authored = combatRoomsFromRings([
    {
      id: "yellow",
      ring: [
        { x: 20, y: 20 },
        { x: 24, y: 20 },
        { x: 24, y: 23 },
        { x: 20, y: 23 },
      ],
    },
  ]);
  const rooms = detectRooms({ ...map, authoredRooms: authored });
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0]!.id, "yellow");
  assert.ok(rooms[0]!.centroid.x > 21 && rooms[0]!.centroid.x < 23);
});
