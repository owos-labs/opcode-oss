import assert from "node:assert/strict";
import test from "node:test";

import { buildCombatMapPlayOverlay } from "./combat-map-play-overlay.ts";
import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";
import { combatTestPlaceholderDocument } from "./combat-test-scene.ts";

const svg = `<svg viewBox="0 0 100 100" meters-per-unit="1">
  <rect x="0" y="0" width="100" height="100" type="bounding_box"/>
  <rect x="40" y="0" width="2" height="100" type="barrier"/>
</svg>`;

test("buildCombatMapPlayOverlay returns fov and movement layers", () => {
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  const placement = {
    id: "npc-1",
    sheetId: "sheet-a",
    label: "A",
    x: 10,
    y: 10,
    team: "friendly",
  };
  const layers = buildCombatMapPlayOverlay({
    map,
    placement,
    placements: [placement],
    sheet: undefined,
  });
  assert.ok(layers.fovPolygon.length >= 8);
  assert.ok(layers.movementDisk.length >= 3);
});
