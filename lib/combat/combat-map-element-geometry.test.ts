import assert from "node:assert/strict";
import test from "node:test";

import { parseCombatMapElements } from "./combat-map-document.ts";
import { combatMapElementBounds, combatMapElementCenter } from "./combat-map-element-geometry.ts";

test("combatMapElementCenter reads rect, circle, and path", () => {
  const svg = `<svg viewBox="0 0 100 100">
<rect name="r" x="10" y="20" width="40" height="20" type="barrier"/>
<circle name="c" cx="5" cy="6" r="3" type="npc_token"/>
<path name="p" type="barrier" d="M0 0L10 0L10 10Z"/>
</svg>`;
  const els = parseCombatMapElements(svg);
  assert.deepEqual(combatMapElementCenter(els.find((e) => e.id === "r")!), { x: 30, y: 30 });
  assert.deepEqual(combatMapElementCenter(els.find((e) => e.id === "c")!), { x: 5, y: 6 });
  assert.deepEqual(combatMapElementCenter(els.find((e) => e.id === "p")!), { x: 20 / 3, y: 10 / 3 }); // (0+10+10)/3, (0+0+10)/3
});

test("combatMapElementBounds returns axis-aligned box for rotated rects", () => {
  const svg = `<svg viewBox="0 0 100 100"><rect name="r" x="0" y="0" width="10" height="20" transform="rotate(90 0 0)" type="barrier"/></svg>`;
  const el = parseCombatMapElements(svg)[0]!;
  const bounds = combatMapElementBounds(el);
  assert.ok(Math.abs((bounds?.width ?? 0) - 20) < 1e-9);
  assert.ok(Math.abs((bounds?.height ?? 0) - 10) < 1e-9);
});
