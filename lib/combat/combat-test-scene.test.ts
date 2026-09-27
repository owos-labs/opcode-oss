import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  COMBAT_TEST_PLACEHOLDER_ACTORS,
  combatTestActorMarkerPercent,
  combatTestPlaceholderDocument,
  parseSvgViewBox,
} from "./combat-test-scene.ts";
import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

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
