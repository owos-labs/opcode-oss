import assert from "node:assert/strict";
import test from "node:test";

import type { CombatMapElement } from "./combat-map-document.ts";
import {
  COMBAT_MAP_SHARED_MIXED,
  sharedConcealmentSelection,
  sharedElementAttr,
  sharedWallLikeKeys,
} from "./combat-map-selection-props.ts";

const el = (id: string, attrs: Record<string, string>, kind: CombatMapElement["kind"] = "barrier"): CombatMapElement => ({
  id,
  kind,
  tag: "rect",
  attrs: { name: id, type: kind, ...attrs },
});

test("sharedElementAttr returns mixed when values differ", () => {
  const elements = [el("a", { fill: "#111111" }), el("b", { fill: "#222222" })];
  assert.equal(sharedElementAttr(elements, "fill"), COMBAT_MAP_SHARED_MIXED);
  assert.equal(sharedElementAttr([el("a", { fill: "#111111" }), el("b", { fill: "#111111" })], "fill"), "#111111");
});

test("sharedWallLikeKeys and sharedConcealmentSelection gate multi-edit fields", () => {
  assert.equal(sharedWallLikeKeys([el("a", {}, "barrier"), el("b", {}, "concealment")]), true);
  assert.equal(sharedWallLikeKeys([el("a", {}, "room")]), false);
  assert.equal(sharedConcealmentSelection([el("a", {}, "concealment")]), true);
});
