import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { hasWalkClear, walkPathMeters } from "../../combat-ai/walk-path.ts";
import { detectPocketRooms, detectRooms, enclosureWalls } from "../rooms.ts";
import { combatMapWalkWalls } from "./compile.ts";
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

test("cover-height half and concealment do not enclose rooms", () => {
  const svg = `<svg viewBox="0 0 100 100">
<rect x="0" y="0" width="100" height="100" type="bounding_box"/>
<rect x="10" y="10" width="40" height="4" type="barrier" cover-height="1"/>
<rect x="10" y="10" width="4" height="40" type="barrier" cover-height="1"/>
<rect x="46" y="10" width="4" height="40" type="barrier" cover-height="1"/>
<rect x="60" y="60" width="8" height="8" type="barrier" cover-height="0.5"/>
<rect x="20" y="70" width="10" height="10" type="concealment" cover-height="0.75"/>
</svg>`;
  const map = compileOpcodeMap({ name: "typed", base: { objects: svg }, runtime: { actors: {} } });
  assert.ok(map.solveBounds);
  assert.ok(map.barriers.some((b) => b.coverHeightBand === "half"));
  assert.ok(map.barriers.some((b) => b.coverHeightBand === "two_thirds" && !b.blocksVision));
  const enclosed = enclosureWalls(map);
  assert.ok(enclosed.length >= 3);
  for (const b of map.barriers) {
    if (b.coverHeightBand !== "full") {
      assert.equal(
        enclosed.some((w) => w.a.x === b.a.x && w.a.y === b.a.y && w.b.x === b.b.x && w.b.y === b.b.y),
        false,
      );
    }
  }
  assert.equal(detectRooms(map).length, 0);
  assert.ok(detectPocketRooms(map).length >= 1);
});

test("yellow fill and type=room become authored rooms, not barriers", () => {
  const svg = `<svg viewBox="0 0 100 50">
<rect name="box" x="0" y="0" width="100" height="50" type="bounding_box"/>
<rect name="hall" x="10" y="10" width="20" height="10" fill="#FFCC24"/>
<rect name="office" x="40" y="10" width="20" height="10" type="room" fill="#FFCC24"/>
<rect name="crate" x="70" y="10" width="8" height="8" type="barrier" cover-height="1"/>
</svg>`;
  const geom = compileSvgMapGeometry(svg, { metersPerUnit: 0.5 });
  assert.deepEqual(
    geom.roomRings.map((r) => r.id).sort(),
    ["hall", "office"],
  );
  assert.ok(geom.barriers.length >= 4);
  assert.ok(geom.barriers.every((b) => b.id.startsWith("crate")));
  const map = compileOpcodeMap({
    name: "yellow",
    base: { objects: svg, metersPerUnit: 0.5 },
    runtime: { actors: {} },
  });
  assert.equal(detectRooms(map).length, 2);
  assert.equal(map.authoredRooms?.length, 2);
});

test("concealment vehicles block walk but not room enclosure", () => {
  const svg = `<svg viewBox="0 0 100 80">
<rect x="0" y="0" width="100" height="80" type="bounding_box"/>
<rect x="30" y="10" width="20" height="40" type="concealment" cover-height="0.75"/>
</svg>`;
  const geom = compileSvgMapGeometry(svg, { metersPerUnit: 0.1 });
  assert.equal(geom.walkRings.length, 1);
  assert.equal(geom.visionRings.length, 0);
  const map = compileOpcodeMap({
    name: "car",
    base: { objects: svg, metersPerUnit: 0.1 },
    runtime: { actors: {} },
  });
  assert.ok((map.navWalls?.length ?? 0) > 0);
  assert.equal(map.walls.length, 0);
  const walls = combatMapWalkWalls(map);
  assert.equal(hasWalkClear({ x: 2, y: 3 }, { x: 6, y: 3 }, walls), false);
  assert.equal(walkPathMeters({ x: 1, y: 3 }, { x: 4, y: 3 }, walls, { maxMeters: 20 }), null);
  assert.ok(walkPathMeters({ x: 1, y: 0.5 }, { x: 8, y: 0.5 }, walls, { maxMeters: 20 }) != null);
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
