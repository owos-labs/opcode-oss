import assert from "node:assert/strict";
import test from "node:test";

import { createLocalSheet, type OpcodeLocalSheet } from "./model.ts";
import { mergeSheetsById } from "./sheet-catalog.ts";

test("mergeSheetsById prefers later groups and dedupes by id", () => {
  const a = createLocalSheet("A");
  const b = createLocalSheet("B");
  const aRenamed = { ...a, name: "A2", updated_at: "2099-01-01T00:00:00.000Z" };
  const merged = mergeSheetsById([a, b], [aRenamed]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((s) => s.id === a.id)?.name, "A2");
});

test("mergeSheetsById sorts by updated_at desc", () => {
  const old = createLocalSheet("old");
  old.updated_at = "2020-01-01T00:00:00.000Z";
  const newer = createLocalSheet("new");
  newer.updated_at = "2025-01-01T00:00:00.000Z";
  const merged = mergeSheetsById([old, newer]);
  assert.equal((merged[0] as OpcodeLocalSheet).name, "new");
});
