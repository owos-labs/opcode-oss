import assert from "node:assert/strict";
import { test } from "node:test";

import { actionKindIndex, ACTION_KINDS } from "./action-feasibility.ts";
import { getNpcDifficultyProfile } from "./difficulty.ts";
import type { ScoredActionOption } from "./planning.ts";
import {
  greedySequence,
  searchRoundPlan,
  selectDualMoveAndStandard,
  selectMoveXorStandard,
} from "./search.ts";

function opt(
  kind: ReturnType<typeof actionKindIndex>,
  utility: number,
  tile = 0,
  target = 0,
): ScoredActionOption {
  return {
    round: 0,
    kind,
    tile,
    target,
    kindId: ACTION_KINDS[kind]!,
    utility,
    utilityUpperBound: utility,
    timing: "immediate",
  };
}

test("selectMoveXorStandard picks higher utility between move and standard", () => {
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const picked = selectMoveXorStandard([
    opt(move, 2, 1, 0),
    opt(fire, 5, 0, 1),
  ]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0]!.kind, fire);
});

test("selectDualMoveAndStandard includes both move and standard when present", () => {
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const picked = selectDualMoveAndStandard([
    opt(move, 2, 1, 0),
    opt(fire, 5, 0, 1),
  ]);
  assert.equal(picked.length, 2);
  const kinds = picked.map(p => p.kind).sort();
  assert.deepEqual(kinds, [move, fire].sort());
});

test("searchRoundPlan for newstupid uses move xor standard", () => {
  const profile = getNpcDifficultyProfile("newstupid");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [opt(move, 1), opt(fire, 9)],
    Date.now(),
    4800,
  );
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0]!.kind, fire);
});

test("trained iterative search prefers round-0 before higher rounds at depth 1", () => {
  const profile = getNpcDifficultyProfile("trained");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [
      { ...opt(move, 10, 1, 0), round: 1 },
      { ...opt(fire, 5, 0, 1), round: 0 },
    ],
    Date.now(),
    4800,
  );
  assert.ok(result.actions.length >= 1);
  assert.equal(result.actions[0]!.kind, fire);
  assert.equal(result.actions[0]!.round, 0);
});

test("searchRoundPlan for novice uses dual selection", () => {
  const profile = getNpcDifficultyProfile("novice");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [opt(move, 1), opt(fire, 9)],
    Date.now(),
    4800,
  );
  assert.equal(result.actions.length, 2);
});
