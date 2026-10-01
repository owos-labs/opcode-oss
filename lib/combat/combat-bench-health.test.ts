import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { benchHealthFromSheet, benchHealthPartIsDestroyed, formatBenchHealthShort } from "./combat-bench-health.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("formatBenchHealthShort and destroyed parts", () => {
  assert.equal(formatBenchHealthShort(null), "—");
  assert.equal(
    formatBenchHealthShort({
      mode: "simple",
      label: "A",
      simpleCurrent: 4,
      simpleMax: 10,
      parts: [],
    }),
    "4/10",
  );
  assert.equal(
    benchHealthPartIsDestroyed({ key: "torso", label: "躯干", current: 0, max: 8 }),
    true,
  );
  assert.equal(
    benchHealthPartIsDestroyed({ key: "torso", label: "躯干", current: 2, max: 8 }),
    false,
  );
});

test("benchHealthFromSheet reads normal mode parts from test-chr", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const view = benchHealthFromSheet(sheet, "Test");
  assert.ok(view);
  if (view!.mode === "simple") {
    assert.ok((view!.simpleMax ?? 0) > 0);
  } else {
    assert.ok(view!.parts.length >= 6);
    assert.ok(view!.parts.some((p) => p.key === "torso" && p.max > 0));
  }
});
