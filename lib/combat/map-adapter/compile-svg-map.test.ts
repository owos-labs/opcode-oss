import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { compileOpcodeMap } from "./compile-opcode-map.ts";
import {
  compileSvgMapGeometry,
  compileSvgToBarriers,
  parseSvgMapShapes,
} from "./compile-svg-map.ts";

const sampleSvg = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/sample-map.svg"),
  "utf8",
);

test("parseSvgMapShapes finds barrier, concealment, and bounding_box", () => {
  const shapes = parseSvgMapShapes(sampleSvg);
  assert.ok(shapes.length >= 6);
  assert.ok(shapes.some(s => s.kind === "concealment" && !s.blocksVision));
  assert.ok(shapes.some(s => s.id === "wall-4"));
});

test("compileSvgToBarriers skips bounding_box and sets cover bands", () => {
  const geom = compileSvgMapGeometry(sampleSvg);
  assert.ok(geom.barriers.length >= 20);
  assert.ok(geom.solveBounds);
  assert.ok(geom.solveBounds!.max.x > geom.solveBounds!.min.x);
  const conc = geom.barriers.find(b => b.id.startsWith("test-conc"));
  assert.ok(conc);
  assert.equal(conc!.blocksVision, false);
  assert.equal(conc!.coverHeightBand, "two_thirds");
  const leg = geom.barriers.find(b => b.id.startsWith("wall-4"));
  assert.equal(leg!.coverHeightBand, "leg");
});

test("compileOpcodeMap accepts SVG string in base.objects", () => {
  const out = compileOpcodeMap({
    name: "svg-map",
    base: { objects: sampleSvg },
    runtime: { actors: { "a": { x: 1, y: 2 } } },
  });
  assert.equal(out.mapId, "svg-map");
  assert.ok(out.barriers.length > 0);
  assert.equal(out.actors.a!.x, 1);
});
