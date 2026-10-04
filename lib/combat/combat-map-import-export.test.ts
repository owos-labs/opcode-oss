import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultCombatMapSvg, createCombatMapDocument } from "./combat-map-document.ts";
import {
  exportCombatMapFilename,
  importCombatMapFromText,
  isCombatMapExportBundle,
  parseCombatMapExportFile,
  roundTripExport,
  serializeCombatMapExport,
} from "./combat-map-import-export.ts";

test("serializeCombatMapExport wraps document in opcode bundle", () => {
  const map = createCombatMapDocument("Arena");
  const text = serializeCombatMapExport(map);
  const raw = JSON.parse(text);
  assert.equal(isCombatMapExportBundle(raw), true);
  assert.equal(raw.map.title, "Arena");
});

test("parseCombatMapExportFile accepts bare legacy document JSON", () => {
  const map = createCombatMapDocument("Legacy");
  const parsed = parseCombatMapExportFile(JSON.stringify(map));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.map.title, "Legacy");
});

test("importCombatMapFromText assigns a new id", () => {
  const map = createCombatMapDocument("Import me");
  const result = importCombatMapFromText(serializeCombatMapExport(map));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.map.id, map.id);
    assert.equal(result.map.inCombat, false);
    assert.equal(result.map.title, "Import me");
  }
});

test("importCombatMapFromText rejects invalid JSON", () => {
  const result = importCombatMapFromText("{not json");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorKey, "combat.editor.import.invalidJson");
});

test("importCombatMapFromText rejects map without bounds", () => {
  const bad = createCombatMapDocument("Bad");
  bad.svg = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="40" height="40" type="barrier"/></svg>`;
  const result = importCombatMapFromText(JSON.stringify(bad));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorKey, "combat.editor.import.complianceFailed");
});

test("roundTripExport preserves svg for valid default map", () => {
  const map = createCombatMapDocument("Round trip");
  const imported = roundTripExport(map);
  assert.ok(imported);
  assert.equal(imported!.svg, map.svg);
});

test("exportCombatMapFilename slugifies title", () => {
  assert.equal(exportCombatMapFilename({ ...createCombatMapDocument("My Map!"), title: "My Map!" }), "My-Map.combat-map.json");
});
