import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";
import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import {
  buildCombatTurnSequence,
  extraInitiativeD10Count,
  initiativeD10Count,
  initiativePoolFromSheet,
  rollInitiativeDice,
  rollInitiativeOrder,
  rollInitiativeValue,
} from "./combat-bench-initiative.ts";
import { mulberry32 } from "../combat-ai/planning.ts";

test("rollInitiativeOrder is deterministic and sorts by roll", () => {
  const sheetA = { stats: { stats: { ref: { base: 10, mod: 0 } } }, status: {} } as CharacterSheet;
  const sheetB = { stats: { stats: { ref: { base: 1, mod: 0 } } }, status: {} } as CharacterSheet;
  const byId = new Map<string, CharacterSheet>([
    ["a", sheetA],
    ["b", sheetB],
  ]);
  const order = rollInitiativeOrder({
    placements: [
      { id: "low", sheetId: "b", label: "Low", x: 0, y: 0, team: "friendly" },
      { id: "high", sheetId: "a", label: "High", x: 1, y: 0, team: "hostile", profileId: "expert" },
    ],
    sheetById: byId,
    deciderPlacementId: "low",
    randomSeed: 99,
  });
  assert.equal(order.length, 2);
  assert.ok(order[0]!.roll >= order[1]!.roll);
  assert.equal(order[0]!.profileId, "expert");
});

test("buildCombatTurnSequence walks rolled order each initiative segment", () => {
  const order = rollInitiativeOrder({
    placements: [
      { id: "ai", sheetId: "a", label: "AI", x: 0, y: 0, team: "hostile" },
      { id: "t", sheetId: "b", label: "T", x: 1, y: 0, team: "friendly" },
    ],
    sheetById: new Map(),
    deciderPlacementId: "ai",
    randomSeed: 1,
  });
  const sequence = buildCombatTurnSequence(order, { ai: 1, t: 0 });
  assert.equal(sequence.length, 3);
  assert.equal(sequence[0]!.placementId, order[0]!.placementId);
  assert.equal(sequence[0]!.slot, 0);
  assert.equal(sequence[1]!.slot, 0);
  assert.equal(sequence[2]!.slot, 1);
  assert.equal(sequence[2]!.placementId, "ai");
});

test("extra initiative d10s unlock at REF 8, 10, and 15", () => {
  assert.equal(extraInitiativeD10Count(7), 0);
  assert.equal(extraInitiativeD10Count(8), 1);
  assert.equal(extraInitiativeD10Count(9), 1);
  assert.equal(extraInitiativeD10Count(10), 2);
  assert.equal(extraInitiativeD10Count(14), 2);
  assert.equal(extraInitiativeD10Count(15), 3);
  assert.equal(initiativeD10Count(6), 1);
  assert.equal(initiativeD10Count(15), 4);
});

test("rollInitiativeDice is Nd10 + REF + bonus", () => {
  const rng = mulberry32(7);
  const rolled = rollInitiativeDice(rng, 6, 0);
  assert.equal(rolled.faces.length, 1);
  assert.ok(rolled.faces[0]! >= 1 && rolled.faces[0]! <= 10);
  assert.equal(rolled.total, rolled.faces[0]! + 6);

  const high = rollInitiativeDice(mulberry32(3), 10, 1);
  assert.equal(high.faces.length, 3);
  assert.equal(
    high.total,
    high.faces.reduce((sum, face) => sum + face, 0) + 11,
  );
});

test("rollInitiativeValue uses d10 spread", () => {
  const rng = mulberry32(7);
  const rolls = new Set<number>();
  for (let i = 0; i < 20; i++) rolls.add(rollInitiativeValue(rng, 5));
  assert.ok(rolls.size > 1);
  for (const total of rolls) {
    assert.ok(total >= 6 && total <= 15);
  }
});

test("rollInitiativeOrder sorts by roll and stores the pool as that total", () => {
  const sheetA = { stats: { stats: { ref: { base: 10, mod: 0 } } }, status: {} } as CharacterSheet;
  const sheetB = { stats: { stats: { ref: { base: 1, mod: 0 } } }, status: {} } as CharacterSheet;
  const order = rollInitiativeOrder({
    placements: [
      { id: "low", sheetId: "b", label: "Low", x: 0, y: 0, team: "friendly" },
      { id: "high", sheetId: "a", label: "High", x: 1, y: 0, team: "hostile" },
    ],
    sheetById: new Map([
      ["a", sheetA],
      ["b", sheetB],
    ]),
    deciderPlacementId: "low",
    randomSeed: 99,
  });
  assert.equal(order[0]!.initiativePool, order[0]!.roll);
  assert.equal(order[0]!.d10Faces.length, initiativeD10Count(order[0]!.ref + order[0]!.initiativeBonus));
  assert.ok(order[0]!.roll >= order[1]!.roll);
});

test("initiativePoolFromSheet uses expected Nd10 + REF for test-chr", () => {
  const pool = initiativePoolFromSheet(
    loadCharacterSheetFromFile(join(dirname(fileURLToPath(import.meta.url)), "fixtures/test-chr.json")),
  );
  assert.equal(pool, 11);
});
