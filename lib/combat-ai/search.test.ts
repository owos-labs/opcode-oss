import assert from "node:assert/strict";
import { test } from "node:test";

import { actionKindIndex, ACTION_KINDS } from "./action-feasibility.ts";
import { getNpcDifficultyProfile } from "./difficulty.ts";
import type { ScoredActionOption } from "./planning.ts";
import {
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

test("selectDualMoveAndStandard pairs a move with a shot at that landing", () => {
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const picked = selectDualMoveAndStandard([
    opt(move, 2, 1, 0),
    opt(fire, 5, 1, 1),
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

test("trained greedy same-round move happens before fire", () => {
  const profile = getNpcDifficultyProfile("trained");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [opt(fire, 9, 1, 1), opt(move, 3, 1, 0)],
    Date.now(),
    4800,
  );
  assert.equal(result.actions[0]!.kind, move);
  assert.equal(result.actions[1]!.kind, fire);
});

test("trained greedy pick prefers round-0 before higher rounds", () => {
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

test("newstupid search never emits both move and a standard", () => {
  const profile = getNpcDifficultyProfile("newstupid");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [opt(move, 4), opt(fire, 4)],
    Date.now(),
    4800,
  );
  const kinds = new Set(result.actions.map(a => a.kind));
  assert.equal(kinds.has(move) && kinds.has(fire), false);
  assert.equal(result.actions.length, 1);
});

test("trained search emits at most 2 standards; expert at most 3", () => {
  const fire = actionKindIndex("standard_fire");
  const fires = [0, 1, 2, 3, 4].map(round => ({ ...opt(fire, 10 - round, 0, 1), round }));
  const trained = searchRoundPlan(getNpcDifficultyProfile("trained"), fires, Date.now(), 4800, 2);
  assert.equal(trained.actions.filter(a => a.kind === fire).length, 2);
  const expert = searchRoundPlan(getNpcDifficultyProfile("expert"), fires, Date.now(), 4800, 3);
  assert.equal(expert.actions.filter(a => a.kind === fire).length, 3);
});

test("zero-utility standard_fire is still chosen when it is the only usable shot", () => {
  const profile = getNpcDifficultyProfile("trained");
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const result = searchRoundPlan(
    profile,
    [opt(move, 0, 0), opt(fire, 0, 0, 1), opt(fire, 0, 0, 2)],
    Date.now(),
    4800,
    1,
  );
  assert.ok(result.actions.some(a => a.kind === fire));
});

test("selectMoveXorStandard prefers fire over hold when both score zero", () => {
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const picked = selectMoveXorStandard([opt(move, 0), opt(fire, 0, 0, 1)]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0]!.kind, fire);
});

test("search never fires from an unselected landing, including simple bots", () => {
  const move = actionKindIndex("move"), fire = actionKindIndex("standard_fire");
  const options = [opt(move, 0, 0), opt(move, 0, 1), opt(fire, 1, 0, 1), opt(fire, 10, 1, 1)];
  for (const tier of ["novice", "trained", "expert", "professional"] as const) {
    const actions = searchRoundPlan(getNpcDifficultyProfile(tier), options, 0, 100, 1).actions;
    assert.equal(actions[0]?.kind, move);
    assert.equal(actions[0]?.tile, 1);
    assert.equal(actions[1]?.tile, 1);
  }
  assert.equal(selectMoveXorStandard(options)[0]?.tile, 0);
});
