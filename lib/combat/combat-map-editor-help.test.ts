import assert from "node:assert/strict";
import test from "node:test";

import { COMBAT_MAP_EDITOR_HELP_ENTRIES } from "./combat-map-editor-help.ts";

test("COMBAT_MAP_EDITOR_HELP_ENTRIES lists unique editor help rows", () => {
  const ids = COMBAT_MAP_EDITOR_HELP_ENTRIES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(COMBAT_MAP_EDITOR_HELP_ENTRIES.length >= 8);
  for (const entry of COMBAT_MAP_EDITOR_HELP_ENTRIES) {
    assert.match(entry.labelKey, /^combat\.editor\.help\./);
  }
});
