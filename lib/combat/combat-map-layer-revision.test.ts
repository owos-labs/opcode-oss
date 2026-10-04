import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCombatMapDocument,
  insertCombatMapRect,
  parseCombatMapElements,
  updateCombatMapElement,
} from "./combat-map-document.ts";
import { combatMapLayerRevision } from "./combat-map-layer-revision.ts";

test("combatMapLayerRevision ignores paint and geometry changes", () => {
  let map = createCombatMapDocument();
  map = { ...map, svg: insertCombatMapRect(map.svg, { kind: "barrier", x: 1, y: 2, width: 10, height: 10 }) };
  const before = combatMapLayerRevision(map.svg, map.layerGroups);
  const moved = updateCombatMapElement(map.svg, parseBarrierId(map.svg), { x: "50", y: "60", fill: "#ff0000" });
  assert.equal(combatMapLayerRevision(moved, map.layerGroups), before);
});

test("combatMapLayerRevision changes when layer names or membership change", () => {
  let map = createCombatMapDocument();
  map = { ...map, svg: insertCombatMapRect(map.svg, { kind: "barrier", x: 1, y: 2, width: 10, height: 10, name: "wall-0" }) };
  const id = parseBarrierId(map.svg);
  const before = combatMapLayerRevision(map.svg, map.layerGroups);
  const renamed = updateCombatMapElement(map.svg, id, { name: "wall-renamed" });
  assert.notEqual(combatMapLayerRevision(renamed, map.layerGroups), before);
});

function parseBarrierId(svg: string) {
  const layer = parseCombatMapElements(svg).find((entry) => entry.kind === "barrier");
  assert.ok(layer);
  return layer.id;
}
