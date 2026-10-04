import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { prepareCombatMapSvgForDisplay, sendBoundsToBack } from "./combat-map-svg-display.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("prepareCombatMapSvgForDisplay injects barrier and concealment styles", () => {
  const raw = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const out = prepareCombatMapSvgForDisplay(raw);
  assert.match(out, /combat-map-svg/);
  assert.match(out, /\[type="barrier"\]/);
  assert.match(out, /\[type="concealment"\]/);
  assert.match(out, /\[type="room"\]/);
});

test("prepareCombatMapSvgForDisplay editor mode keeps rooms clickable", () => {
  const raw = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const out = prepareCombatMapSvgForDisplay(raw, "editor");
  assert.match(out, /\[type="room"\][^}]*pointer-events: auto/);
});

test("sendBoundsToBack moves bounding_box before map shapes", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="wall-0" type="barrier" x="10" y="10" width="20" height="4"/><rect name="bounds" x="0" y="0" width="100" height="100" type="bounding_box"/></svg>`;
  const out = sendBoundsToBack(raw);
  assert.ok(out.indexOf('name="bounds"') < out.indexOf('name="wall-0"'));
});

test("sendBoundsToBack works when bounding_box has no name", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="wall-0" type="barrier" x="10" y="10" width="20" height="4"/><rect x="0" y="0" width="100" height="100" type="bounding_box"/></svg>`;
  const out = sendBoundsToBack(raw);
  assert.ok(out.indexOf('type="bounding_box"') < out.indexOf('name="wall-0"'));
});

test("prepareCombatMapSvgForDisplay editor mode makes bounds non-interactive", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="bounds" x="0" y="0" width="100" height="100" type="bounding_box"/></svg>`;
  const out = prepareCombatMapSvgForDisplay(raw, "editor");
  assert.doesNotMatch(out, /data-bounds-hit/);
  assert.match(out, /rect\[type="bounding_box"\][^}]*pointer-events: none/);
  assert.match(out, /rect\[type="bounding_box"\][^}]*stroke: none/);
});

test("prepareCombatMapSvgForDisplay editor mode does not override explicit barrier fill", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="w" type="barrier" fill="#ff0000" stroke="#00ff00" x="0" y="0" width="10" height="10"/></svg>`;
  const out = prepareCombatMapSvgForDisplay(raw, "editor");
  assert.match(out, /rect\[type="barrier"\]:not\(\[fill\]\)/);
});

test("prepareCombatMapSvgForDisplay editor mode hides in-svg wall strokes", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="w" type="barrier" x="0" y="0" width="10" height="2"/></svg>`;
  const out = prepareCombatMapSvgForDisplay(raw, "editor");
  assert.match(out, /rect\[type="barrier"\].*stroke: none/s);
});

test("prepareCombatMapSvgForDisplay editor mode does not override explicit bounds colors", () => {
  const raw = `<svg viewBox="0 0 100 100"><rect name="bounds" type="bounding_box" fill="#ff0000" stroke="#00ff00" x="0" y="0" width="100" height="100"/></svg>`;
  const out = prepareCombatMapSvgForDisplay(raw, "editor");
  assert.match(out, /rect\[type="bounding_box"\]:not\(\[fill\]\)/);
  assert.match(out, /rect\[type="bounding_box"\]:not\(\[stroke\]\)/);
  assert.doesNotMatch(out, /rect\[type="bounding_box"\]\s*\{[^}]*fill:\s*#ffffff/);
});

test("prepareCombatMapSvgForDisplay bench mode ignores room pointer events", () => {
  const raw = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const out = prepareCombatMapSvgForDisplay(raw, "bench");
  assert.match(out, /\[type="room"\][^}]*pointer-events: none/);
});
