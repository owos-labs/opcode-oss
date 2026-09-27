import assert from "node:assert/strict";
import test from "node:test";

import { evaluateBenchCombatOutcome, placementIsNeutralized } from "./combat-bench-outcome.ts";

test("evaluateBenchCombatOutcome ends when hostile team neutralized", () => {
  const placements = [
    { id: "h", sheetId: "s", label: "H", x: 0, y: 0, team: "hostile" as const },
    { id: "f", sheetId: "s", label: "F", x: 1, y: 0, team: "friendly" as const },
  ];
  const out = evaluateBenchCombatOutcome(placements, {
    h: { current: 0, max: 10 },
    f: { current: 5, max: 10 },
  });
  assert.equal(out.ended, true);
  assert.equal(out.winningTeam, "friendly");
});

test("placementIsNeutralized at zero hp", () => {
  assert.equal(placementIsNeutralized({ current: 0, max: 10 }), true);
  assert.equal(placementIsNeutralized({ current: 1, max: 10 }), false);
});
