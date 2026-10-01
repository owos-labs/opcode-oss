import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import {
  declaredStandardActionsForRound,
  priorStandardFireCount,
  priorStandardFireRoundsThisRound,
  rangedAttackActionMalus,
  rangedAttackMalusParts,
  standardActionsDeclaredInPlan,
} from "./standard-action-malus.ts";

function plan(actions: RoundPlan["actions"]): RoundPlan {
  return {
    snapshotVersion: 1,
    randomSeed: 1,
    actions,
    completedDepth: 0,
    totalUtility: 0,
    timedOut: false,
  };
}

test("rangedAttackActionMalus stacks unified and consecutive fire penalties", () => {
  assert.equal(
    rangedAttackActionMalus({ declaredStandardActions: 2, priorStandardFiresThisRound: 0 }),
    -3,
  );
  assert.equal(
    rangedAttackActionMalus({ declaredStandardActions: 2, priorStandardFiresThisRound: 1 }),
    -6,
  );
});

test("priorStandardFireRoundsThisRound ignores suppressive_fire", () => {
  const suppress = actionKindIndex("suppressive_fire");
  const roundPlan = plan([
    { round: 0, kind: suppress, tile: 0, target: 0, timing: "immediate" },
    { round: 1, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
  ]);
  assert.equal(priorStandardFireRoundsThisRound(roundPlan, 0), 0);
  assert.equal(priorStandardFireRoundsThisRound(roundPlan, 1), 0);
});

test("priorStandardFireCount counts only earlier slots", () => {
  const roundPlan = plan([
    { round: 0, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
    { round: 1, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
  ]);
  assert.equal(priorStandardFireCount(roundPlan, 0), 0);
  assert.equal(priorStandardFireCount(roundPlan, 1), 1);
  assert.equal(standardActionsDeclaredInPlan(roundPlan), 2);
});

test("declaredStandardActionsForRound caps by affordable initiative slots", () => {
  const roundPlan = plan([
    { round: 0, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
    { round: 1, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
    { round: 2, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" },
  ]);
  assert.equal(declaredStandardActionsForRound(roundPlan, 21), 3);
  assert.equal(declaredStandardActionsForRound(roundPlan, 8), 1);
});
