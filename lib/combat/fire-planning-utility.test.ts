import assert from "node:assert/strict";
import { test } from "node:test";

import { actionFeasibilityIndex, actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { decideRoundPlan } from "../combat-ai/decide.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { ballisticFireReachUtility, firePlanningUtility } from "./fire-planning-utility.ts";
import { standardFireExpectation } from "./attack-expectation.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";

const openMap = { mapId: "open", walls: [], barriers: [], emplacements: [] } as const;

function holdFireUtility(payload: ReturnType<typeof buildPlanningPayload>): number {
  const fire = actionKindIndex("standard_fire");
  const idx = actionFeasibilityIndex(payload.shape, 0, fire, 0, 1);
  assert.equal(payload.feasibility.legal[idx], 1);
  return payload.utility[idx]!;
}

test("strong shooter uses expectation, not ballistic floor", () => {
  const snapshot = defaultCombatSnapshot({ attackBonus: 10, initiativeTotal: 21 });
  const view = snapshot.targets[0]!;
  const expected = standardFireExpectation(
    { ...snapshot, declaredStandardActions: 1, declaredStandardFires: 1 },
    openMap.barriers,
    snapshot.position,
    view,
  ).damage;
  const floor = ballisticFireReachUtility(snapshot, openMap, snapshot.position, view);
  const utility = firePlanningUtility(snapshot, openMap, snapshot.position, view);
  assert.ok(expected > floor);
  assert.equal(utility, expected);
});

test("weak shooter gets ballistic floor when clean expectation is zero", () => {
  const snapshot = defaultCombatSnapshot({ attackBonus: -5, initiativeTotal: 13 });
  const view = snapshot.targets[0]!;
  const clean = standardFireExpectation(
    { ...snapshot, declaredStandardActions: 1, declaredStandardFires: 1, standardFiresThisRound: 0 },
    openMap.barriers,
    snapshot.position,
    view,
  ).damage;
  const floor = ballisticFireReachUtility(snapshot, openMap, snapshot.position, view);
  const utility = firePlanningUtility(snapshot, openMap, snapshot.position, view);
  assert.equal(clean, 0);
  assert.ok(floor > 0);
  assert.equal(utility, floor);
});

test("planning payload applies floor on hold-fire when expectation is zero", () => {
  const snapshot = defaultCombatSnapshot({ attackBonus: 0, initiativeTotal: 13 });
  const payload = buildPlanningPayload(snapshot, openMap);
  assert.ok(holdFireUtility(payload) > 0);
});

test("malus can keep utility at zero when a clean single shot would still score", () => {
  const snapshot = defaultCombatSnapshot({ attackBonus: 10, initiativeTotal: 21 });
  const view = snapshot.targets[0]!;
  const malusSnapshot = {
    ...snapshot,
    declaredStandardActions: 2,
    declaredStandardFires: 2,
    standardFiresThisRound: 1,
  };
  const clean = standardFireExpectation(
    { ...snapshot, declaredStandardActions: 1, declaredStandardFires: 1, standardFiresThisRound: 0 },
    openMap.barriers,
    snapshot.position,
    view,
  ).damage;
  const underMalus = standardFireExpectation(
    malusSnapshot,
    openMap.barriers,
    snapshot.position,
    view,
  ).damage;
  assert.ok(clean > 0);
  assert.equal(underMalus, 0);
  assert.equal(firePlanningUtility(malusSnapshot, openMap, snapshot.position, view), 0);
});

test("positive expectation still produces fire actions", () => {
  const snapshot = defaultCombatSnapshot({ attackBonus: 10, initiativeTotal: 21 });
  const payload = buildPlanningPayload(snapshot, openMap);
  const plan = decideRoundPlan({
    profileId: "trained",
    feasibility: payload.feasibility,
    utility: payload.utility,
    randomSeed: 42,
    snapshotVersion: 1,
    maxStandardActions: payload.maxStandardActions,
  });
  assert.ok(plan.actions.some((a) => a.kind === actionKindIndex("standard_fire")));
});
