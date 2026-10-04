import assert from "node:assert/strict";
import test from "node:test";

import { applyStyleDomPatch, rectPatchFromAttrs } from "./combat-map-canvas-preview.ts";

test("applyStyleDomPatch updates fill and stroke attrs", () => {
  const attrs: Record<string, string> = {};
  const node = {
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
  } as unknown as Element;
  applyStyleDomPatch(node, { fill: "#ff0000", stroke: "#00ff00" });
  assert.equal(attrs.fill, "#ff0000");
  assert.equal(attrs.stroke, "#00ff00");
});

test("rectPatchFromAttrs maps svg rect attrs", () => {
  assert.deepEqual(rectPatchFromAttrs({ x: "1", y: "2", width: "3", height: "4" }), {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  });
  assert.deepEqual(rectPatchFromAttrs({ transform: "rotate(45 5 5)" }).transform, "rotate(45 5 5)");
});
