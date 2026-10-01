import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  COMBAT_BENCH_MAPS,
  COMBAT_TEST_PLACEHOLDER_ACTORS,
  combatBenchMapById,
  combatBenchMapMetersPerUnit,
  combatTestActorMarkerPercent,
  combatTestPlaceholderDocument,
  parseSvgViewBox,
} from "./combat-test-scene.ts";
import { hasWalkClear, walkPathMeters } from "../combat-ai/walk-path.ts";
import { combatMapWalkWalls } from "./map-adapter/compile.ts";
import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";
import { detectRooms } from "./rooms.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("COMBAT_BENCH_MAPS lists sample and connected-walls", () => {
  assert.deepEqual(
    COMBAT_BENCH_MAPS.map((m) => m.id),
    ["sample", "connected-walls"],
  );
  assert.equal(combatBenchMapById("connected-walls").path, "/combat/connected-walls.svg");
  assert.equal(combatBenchMapById("connected-walls").widthMeters, (1049 * 1.8) / 88);
  assert.equal(combatBenchMapById("sample").widthMeters, 100);
  assert.equal(combatBenchMapById("missing").id, "sample");
});

test("sample map without yellow rooms has no rooms", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const compiled = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  assert.equal(compiled.authoredRooms, undefined);
  assert.equal(detectRooms(compiled).length, 0);
});

test("connected-walls yellow rooms compile at vehicle-width scale", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/connected-walls.svg"), "utf8");
  const viewBox = parseSvgViewBox(svg);
  assert.ok(viewBox);
  const mpu = combatBenchMapMetersPerUnit("connected-walls", viewBox.w);
  const compiled = compileOpcodeMap(combatTestPlaceholderDocument(svg, "connected-walls", mpu));
  assert.equal(compiled.authoredRooms?.length, 10);
  assert.equal(detectRooms(compiled).length, 10);
  assert.ok(compiled.solveBounds);
  assert.ok(compiled.solveBounds!.max.x > 20 && compiled.solveBounds!.max.x < 22);
  assert.ok(Math.abs(88 * mpu - 1.8) < 1e-9);
  assert.ok(Math.abs((compiled.metersPerUnit ?? 0) - mpu) < 1e-12);
  const nav = combatMapWalkWalls(compiled);
  assert.equal(hasWalkClear({ x: 160 * mpu, y: 210 * mpu }, { x: 270 * mpu, y: 210 * mpu }, nav), false);
  assert.equal(
    walkPathMeters({ x: 160 * mpu, y: 210 * mpu }, { x: 217 * mpu, y: 210 * mpu }, nav, { maxMeters: 20 }),
    null,
  );
});

test("placeholder document names the selected map", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const compiled = compileOpcodeMap(combatTestPlaceholderDocument(svg, "connected-walls"));
  assert.equal(compiled.mapId, "connected-walls");
});

test("placeholder document compiles sample-map SVG", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const compiled = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  assert.equal(compiled.mapId, "sample-map");
  assert.ok(compiled.barriers.length > 0);
  assert.ok(compiled.actors["npc-1"]);
});

test("actor marker maps tactical meters into viewBox percentages", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const viewBox = parseSvgViewBox(svg);
  assert.ok(viewBox);
  const npc = COMBAT_TEST_PLACEHOLDER_ACTORS[0]!;
  const pct = combatTestActorMarkerPercent(npc, viewBox);
  assert.ok(pct.leftPct >= 0 && pct.leftPct <= 100);
  assert.ok(pct.topPct >= 0 && pct.topPct <= 100);
});
