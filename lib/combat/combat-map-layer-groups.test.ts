import assert from "node:assert/strict";
import test from "node:test";

import type { CombatMapElement } from "./combat-map-document.ts";
import {
  buildCombatMapLayerRows,
  createLayerGroupFromSelection,
  removeLayerFromGroups,
  stripMembersFromGroups,
  ungroupSelectedLayers,
} from "./combat-map-layer-groups.ts";

const el = (id: string, kind: CombatMapElement["kind"] = "barrier"): CombatMapElement => ({
  id,
  kind,
  tag: "rect",
  attrs: { name: id, type: kind },
});

test("createLayerGroupFromSelection requires two or more layers", () => {
  const elements = [el("wall-0"), el("wall-1"), el("bounds", "bounding_box")];
  assert.equal(createLayerGroupFromSelection([], ["wall-0"], elements), null);
  const created = createLayerGroupFromSelection([], ["wall-0", "wall-1"], elements);
  assert.equal(created?.groups.length, 1);
  assert.deepEqual(created?.groups[0]?.memberIds, ["wall-0", "wall-1"]);
});

test("buildCombatMapLayerRows nests grouped members once at first member position", () => {
  const elements = [el("bounds", "bounding_box"), el("wall-0"), el("wall-1"), el("cover-0", "concealment")];
  const groups = [{ id: "group-0", name: "Walls", memberIds: ["wall-0", "wall-1"] }];
  const rows = buildCombatMapLayerRows(elements, groups);
  assert.deepEqual(
    rows.map((row) => (row.kind === "group" ? `group:${row.id}` : row.id)),
    ["bounds", "group:group-0", "cover-0"],
  );
});

test("ungroupSelectedLayers removes selected members from groups", () => {
  const groups = [{ id: "group-0", name: "Walls", memberIds: ["wall-0", "wall-1"] }];
  const next = ungroupSelectedLayers(groups, ["wall-0"]);
  assert.deepEqual(next[0]?.memberIds, ["wall-1"]);
  assert.deepEqual(stripMembersFromGroups(groups, ["wall-0", "wall-1"]), []);
  assert.deepEqual(removeLayerFromGroups(groups, "wall-0")[0]?.memberIds, ["wall-1"]);
});
