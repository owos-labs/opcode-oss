import assert from "node:assert/strict";
import test from "node:test";

import { evaluateBenchCombatOutcome, placementIsNeutralized } from "./combat-bench-outcome.ts";

test("evaluateBenchCombatOutcome ends when hostile team neutralized", () => {
  const placements = [
    { id: "h", sheetId: "s", label: "H", x: 0, y: 0, team: "hostile" as const },
    { id: "f", sheetId: "s", label: "F", x: 1, y: 0, team: "friendly" as const },
  ];
  const out = evaluateBenchCombatOutcome(placements, {
    h: {
      current: 0,
      max: 10,
      vitals: {
        stunGauge: 0,
        stunPenalty: 0,
        damageTaken: 10,
        deathSaveDifficultyReduction: 0,
        unconscious: false,
        deathSave: true,
        dead: false,
      },
    },
    f: { current: 5, max: 10 },
  });
  assert.equal(out.ended, true);
  assert.equal(out.winningTeam, "friendly");
});

test("placementIsNeutralized uses vitals not raw hp alone", () => {
  assert.equal(placementIsNeutralized({ current: 0, max: 10 }), true);
  assert.equal(placementIsNeutralized({ current: 1, max: 10 }), false);
  assert.equal(
    placementIsNeutralized({
      current: 4,
      max: 10,
      vitals: {
        stunGauge: 10,
        stunPenalty: 0,
        damageTaken: 0,
        deathSaveDifficultyReduction: 0,
        unconscious: true,
        deathSave: false,
        dead: false,
      },
    }),
    true,
  );
});

test("evaluateBenchCombatOutcome keeps custom team names fighting", () => {
  const placements = [
    { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "alpha" },
    { id: "b", sheetId: "s", label: "B", x: 1, y: 0, team: "bravo" },
  ];
  const out = evaluateBenchCombatOutcome(placements, {
    a: { current: 8, max: 10 },
    b: { current: 8, max: 10 },
  });
  assert.equal(out.ended, false);
  assert.equal(out.reason, "ongoing");
});

test("evaluateBenchCombatOutcome ends when only one custom team remains", () => {
  const placements = [
    { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "alpha" },
    { id: "b", sheetId: "s", label: "B", x: 1, y: 0, team: "bravo" },
  ];
  const out = evaluateBenchCombatOutcome(placements, {
    a: {
      current: 0,
      max: 10,
      vitals: {
        stunGauge: 0,
        stunPenalty: 0,
        damageTaken: 10,
        deathSaveDifficultyReduction: 0,
        unconscious: false,
        deathSave: true,
        dead: false,
      },
    },
    b: { current: 8, max: 10 },
  });
  assert.equal(out.ended, true);
  assert.equal(out.winningTeam, "bravo");
  assert.equal(out.reason, "faction_eliminated");
});

test("evaluateBenchCombatOutcome keeps a solo bot in play", () => {
  const out = evaluateBenchCombatOutcome(
    [{ id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" }],
    { a: { current: 8, max: 10 } },
  );
  assert.equal(out.ended, false);
  assert.equal(out.reason, "ongoing");
});

test("null hp counts as still fighting", () => {
  const placements = [
    { id: "h", sheetId: "s", label: "H", x: 0, y: 0, team: "hostile" },
    { id: "f", sheetId: "s", label: "F", x: 1, y: 0, team: "friendly" },
  ];
  const out = evaluateBenchCombatOutcome(placements, {
    h: { current: null, max: null },
    f: { current: null, max: null },
  });
  assert.equal(out.ended, false);
});
