import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { prepareCombatMapSvgForDisplay } from "./combat-map-svg-display.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("prepareCombatMapSvgForDisplay injects barrier and concealment styles", () => {
  const raw = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const out = prepareCombatMapSvgForDisplay(raw);
  assert.match(out, /combat-map-svg/);
  assert.match(out, /\[type="barrier"\]/);
  assert.match(out, /\[type="concealment"\]/);
  assert.match(out, /\[type="room"\]/);
});
