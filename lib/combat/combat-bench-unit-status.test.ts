import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { benchUnitStatusViews } from "./combat-bench-unit-status.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("benchUnitStatusViews includes weapon and health from sheet", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map([[sheet.id, sheet]]);
  const views = benchUnitStatusViews({
    placements: [
      {
        id: "p1",
        sheetId: sheet.id,
        label: "A",
        x: 1,
        y: 2,
        team: "hostile",
      },
    ],
    sheetById: byId,
    session: null,
    deciderPlacementId: "p1",
    selectedPlacementId: null,
  });
  assert.equal(views.length, 1);
  assert.ok(views[0]!.weaponName);
  assert.ok(views[0]!.weapon);
  assert.ok(views[0]!.health);
  assert.equal(views[0]!.hearingA, 20);
  assert.equal(views[0]!.openVisionV, 200);
  assert.equal(views[0]!.passiveS, 10);
});
