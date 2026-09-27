import assert from "node:assert/strict";
import test from "node:test";

import {
  actionKindIndex,
  createActionFeasibilityTensor,
  setActionLegal,
} from "../combat-ai/action-feasibility.ts";
import { getNpcDifficultyProfile } from "../combat-ai/difficulty.ts";
import type { ScoredActionOption } from "../combat-ai/planning.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import type { CombatSnapshot } from "./snapshot.ts";
import { greedySequenceStateful, searchRoundPlanWithSimulation } from "./stateful-plan-search.ts";

function opt(
  kind: number,
  utility: number,
  tile: number,
  round = 0,
): ScoredActionOption {
  return {
    round,
    kind,
    tile,
    target: 0,
    utility,
    utilityUpperBound: utility,
    kindId: kind === actionKindIndex("move") ? "move" : "suppressive_fire",
    timing: "immediate",
  };
}

test("stateful greedy stops stacking moves when mov budget is exhausted", () => {
  const move = actionKindIndex("move");
  const snapshot = {
    position: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    ammo: { roundsInMagazine: 30 },
  } as CombatSnapshot;
  const payload = {
    stancePositions: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
    feasibility: createActionFeasibilityTensor({
      initiativeRounds: 1,
      kinds: 8,
      reachableTiles: 4,
      targets: 1,
    }),
  } as PlanningPayload;
  setActionLegal(payload.feasibility, 0, move, 1, 0, true);
  setActionLegal(payload.feasibility, 0, move, 2, 0, true);
  setActionLegal(payload.feasibility, 0, move, 3, 0, true);

  const seq = greedySequenceStateful(
    [opt(move, 2, 1), opt(move, 2, 2), opt(move, 2, 3)],
    3,
    { snapshot, payload },
  );
  assert.equal(seq.length, 1);
  assert.equal(seq[0]!.tile, 1);
});

test("searchRoundPlanWithSimulation uses stateful path for professional", () => {
  const profile = getNpcDifficultyProfile("professional");
  const move = actionKindIndex("move");
  const snapshot = {
    position: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    ammo: { roundsInMagazine: 30 },
  } as CombatSnapshot;
  const payload = {
    stancePositions: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }],
    feasibility: createActionFeasibilityTensor({
      initiativeRounds: 2,
      kinds: 8,
      reachableTiles: 3,
      targets: 1,
    }),
  } as PlanningPayload;
  setActionLegal(payload.feasibility, 0, move, 1, 0, true);
  setActionLegal(payload.feasibility, 0, move, 2, 0, true);

  const result = searchRoundPlanWithSimulation(
    profile,
    [opt(move, 2, 1), opt(move, 2, 2)],
    { snapshot, payload },
    Date.now(),
    4800,
  );
  const moves = result.actions.filter((a) => a.kind === move);
  assert.equal(moves.length, 1);
});
