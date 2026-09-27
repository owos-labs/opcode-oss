import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { compileOpcodeMap, rectangleSegments } from "./compile-opcode-map.ts";
import type { OpcodeMapDocument } from "./opcode-map.types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const alleyPath = join(here, "../fixtures/opcode-map-alley.json");

test("rectangleSegments produces four edges", () => {
  const segs = rectangleSegments("box", [0, 0], { w: 2, h: 1 }, 0);
  assert.equal(segs.length, 4);
});

test("compileOpcodeMap reads opcode-map-alley.json", () => {
  const doc = JSON.parse(readFileSync(alleyPath, "utf8")) as OpcodeMapDocument;
  const out = compileOpcodeMap(doc);
  assert.equal(out.mapId, "opcode-alley");
  assert.ok(out.barriers.length >= 8);
  assert.equal(out.walls.length, 4);
  assert.deepEqual(Object.keys(out.actors).sort(), ["hostile-1", "npc-1"]);
  assert.equal(out.actors["npc-1"]!.x, 0);
});

test("explicit segments override size proxy", () => {
  const doc: OpcodeMapDocument = {
    name: "seg-only",
    base: {
      objects: {
        o1: {
          ar: 10,
          ssp: 5,
          start: [0, 0],
          segments: [
            {
              id: "only",
              a: { x: 0, y: 0 },
              b: { x: 1, y: 0 },
              armorRating: 10,
              maxSsp: 5,
              currentSsp: 5,
              blocksVision: true,
            },
          ],
        },
      },
    },
  };
  const out = compileOpcodeMap(doc);
  assert.equal(out.barriers.length, 1);
  assert.equal(out.barriers[0]!.id, "only");
});
