import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import type { CombatSnapshot } from "./snapshot.ts";
import { buildCombatBenchActionBudgetView } from "./combat-bench-action-budget.ts";

function minimalBundle(input: {
  plan: RoundPlan;
  stancePositions: { x: number; y: number }[];
  snapshot?: Partial<CombatSnapshot>;
}): { snapshot: CombatSnapshot; payload: PlanningPayload; plan: RoundPlan } {
  const snapshot = {
    position: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    initiativeTotal: 30,
    initiativeRemaining: 30,
    ...input.snapshot,
  } as CombatSnapshot;
  const payload = {
    stancePositions: [{ x: 0, y: 0 }, ...input.stancePositions],
    targetIds: [null],
    shape: { initiativeRounds: 2, kinds: 8, reachableTiles: 3, targets: 1 },
  } as PlanningPayload;
  return { snapshot, payload, plan: input.plan };
}

test("buildCombatBenchActionBudgetView chains move legs and initiative by round", () => {
  const move = actionKindIndex("move");
  const view = buildCombatBenchActionBudgetView(
    minimalBundle({
      stancePositions: [{ x: 3, y: 4 }, { x: 0, y: 5 }],
      plan: {
        snapshotVersion: 1,
        randomSeed: 1,
        completedDepth: 2,
        totalUtility: 2,
        timedOut: false,
        actions: [
          { round: 0, kind: move, tile: 1, target: 0, timing: "immediate" },
          { round: 1, kind: move, tile: 2, target: 0, timing: "immediate" },
        ],
      },
    }),
  );
  assert.equal(view.moveLegs.length, 2);
  assert.ok(Math.abs(view.moveLegs[0]!.meters - 5) < 1e-6);
  assert.equal(view.initiativePlannedSpend, 3 + 6);
  assert.equal(view.rounds.length, 2);
  assert.ok(Math.abs(view.movPlannedSpend - (5 + Math.hypot(3, 1))) < 1e-6);
});

test("action budget skips extra moves in same round and over mov cap", () => {
  const move = actionKindIndex("move");
  const view = buildCombatBenchActionBudgetView(
    minimalBundle({
      snapshot: { mov: 10, metersMovedThisRound: 0 },
      stancePositions: [
        { x: 10, y: 0 },
        { x: 0, y: 1 },
      ],
      plan: {
        snapshotVersion: 1,
        randomSeed: 1,
        completedDepth: 3,
        totalUtility: 3,
        timedOut: false,
        actions: [
          { round: 0, kind: move, tile: 1, target: 0, timing: "immediate" },
          { round: 0, kind: move, tile: 2, target: 0, timing: "immediate" },
        ],
      },
    }),
  );
  assert.equal(view.moveLegs.length, 1);
  assert.ok(Math.abs(view.movPlannedSpend - 10) < 1e-6);
});
