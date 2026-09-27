import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { planGroupedByInitiativeRound } from "./combat-plan-intent.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

test("planGroupedByInitiativeRound groups actions by round", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "t1"],
  } as PlanningPayload;
  const groups = planGroupedByInitiativeRound(
    payload,
    {
      snapshotVersion: 1,
      randomSeed: 1,
      actions: [
        {
          round: 1,
          kind: actionKindIndex("move"),
          tile: 0,
          target: 0,
          timing: "immediate",
        },
        {
          round: 0,
          kind: actionKindIndex("standard_fire"),
          tile: 0,
          target: 1,
          timing: "immediate",
        },
      ],
      completedDepth: 2,
      totalUtility: 1,
      timedOut: false,
    },
    () => "T",
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.round, 0);
  assert.match(groups[0]!.rows[0]!.text, /standard_fire/);
});
