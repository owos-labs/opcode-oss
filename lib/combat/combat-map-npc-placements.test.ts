import assert from "node:assert/strict";
import test from "node:test";

import { parseCombatMapElements } from "./combat-map-document.ts";
import { combatMapNpcPlacements } from "./combat-map-npc-placements.ts";

const svg = `<svg viewBox="0 0 100 100" meters-per-unit="0.1">
  <circle id="npc-1" cx="20" cy="30" r="5" type="npc_token" sheet-id="sheet-a" />
</svg>`;

test("combatMapNpcPlacements converts npc_token centers to meters", () => {
  const elements = parseCombatMapElements(svg);
  const placements = combatMapNpcPlacements(elements, svg, 0.1, (sheetId) => sheetId);
  assert.equal(placements.length, 1);
  assert.equal(placements[0]!.id, "npc-1");
  assert.equal(placements[0]!.sheetId, "sheet-a");
  assert.equal(placements[0]!.x, 2);
  assert.equal(placements[0]!.y, 3);
});
