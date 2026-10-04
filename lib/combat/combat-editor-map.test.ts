import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCombatMapDocument,
  insertCombatMapRect,
  parseCombatMapElements,
} from "./combat-map-document.ts";
import { deleteCombatMapLayer, renameCombatMapLayer, setCombatMapLayerGroups } from "./combat-editor-map.ts";

test("deleteCombatMapLayer removes a deletable element and prunes layer groups", () => {
  let map = createCombatMapDocument();
  map = { ...map, svg: insertCombatMapRect(map.svg, { kind: "barrier", x: 10, y: 10, width: 20, height: 20 }) };
  const layer = parseElements(map).find((entry) => entry.kind === "barrier");
  assert.ok(layer);
  map = {
    ...map,
    layerGroups: [{ id: "g1", name: "Group", memberIds: [layer.id] }],
  };

  const next = deleteCombatMapLayer(map, layer.id);
  assert.ok(next);
  assert.equal(parseElements(next).filter((entry) => entry.kind === "barrier").length, 0);
  assert.deepEqual(next.layerGroups, []);
});

test("renameCombatMapLayer updates display name and returns the canonical id", () => {
  let map = createCombatMapDocument();
  map = { ...map, svg: insertCombatMapRect(map.svg, { kind: "barrier", x: 10, y: 10, width: 20, height: 20 }) };
  const layer = parseElements(map).find((entry) => entry.kind === "barrier");
  assert.ok(layer);

  const { map: next, id } = renameCombatMapLayer(map, layer.id, "crate-a");
  assert.equal(id, layer.id);
  assert.match(next.svg, /name="crate-a"/);
});

test("setCombatMapLayerGroups prunes missing members", () => {
  let map = createCombatMapDocument();
  map = { ...map, svg: insertCombatMapRect(map.svg, { kind: "barrier", x: 10, y: 10, width: 20, height: 20 }) };
  const layer = parseElements(map).find((entry) => entry.kind === "barrier");
  assert.ok(layer);

  const next = setCombatMapLayerGroups(map, [
    { id: "g1", name: "Group", memberIds: [layer.id, "missing"] },
  ]);
  assert.deepEqual(next.layerGroups, [{ id: "g1", name: "Group", memberIds: [layer.id] }]);
});

function parseElements(map: ReturnType<typeof createCombatMapDocument>) {
  return parseCombatMapElements(map.svg);
}
