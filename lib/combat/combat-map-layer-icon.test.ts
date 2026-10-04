import assert from "node:assert/strict";
import test from "node:test";

import { combatMapLayerIconKind } from "./combat-map-layer-icon.ts";

test("combatMapLayerIconKind maps element kinds to sidebar icons", () => {
  assert.equal(combatMapLayerIconKind("bounding_box"), "bounds");
  assert.equal(combatMapLayerIconKind("barrier"), "wall");
  assert.equal(combatMapLayerIconKind("concealment"), "cover");
  assert.equal(combatMapLayerIconKind("room"), "room");
  assert.equal(combatMapLayerIconKind("npc_token"), "npc");
  assert.equal(combatMapLayerIconKind("unknown"), "unknown");
});
