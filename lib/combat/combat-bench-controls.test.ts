import assert from "node:assert/strict";
import test from "node:test";

import type { CombatBenchSession } from "./combat-bench.ts";
import {
  benchCanEditRoster,
  benchFightActive,
  benchStartAllowed,
  benchStepAllowed,
  benchStepAtRoundBoundary,
} from "./combat-bench-controls.ts";

function minimalSession(overrides: Partial<CombatBenchSession> = {}): CombatBenchSession {
  return {
    combatRound: 1,
    turnIndex: 0,
    turnSequence: [{ placementId: "a", label: "A", slot: 0, isDecider: true }],
    initiativeOrder: [],
    deciderPlacementId: "a",
    randomSeed: 1,
    plansByPlacementId: {},
    topOptionsByPlacementId: {},
    healthByPlacementId: {},
    combatEnded: false,
    endReason: null,
    intel: { mission: "hunt", records: new Map() },
    fsmByPlacementId: {},
    ...overrides,
  } as CombatBenchSession;
}

test("benchStartAllowed only before fight starts", () => {
  const base = { validationOk: true, mapReady: true, busy: false };
  assert.equal(benchStartAllowed({ ...base, session: null }), true);
  assert.equal(benchStartAllowed({ ...base, session: minimalSession() }), false);
  assert.equal(
    benchStartAllowed({ ...base, session: minimalSession({ combatEnded: true }) }),
    true,
  );
});

test("benchStepAllowed while fight is active", () => {
  assert.equal(
    benchStepAllowed({ session: minimalSession(), benchMapReady: true, busy: false }),
    true,
  );
  assert.equal(
    benchStepAllowed({ session: null, benchMapReady: true, busy: false }),
    false,
  );
  assert.equal(
    benchStepAllowed({
      session: minimalSession({ combatEnded: true }),
      benchMapReady: true,
      busy: false,
    }),
    false,
  );
});

test("benchStepAtRoundBoundary when turn index reached sequence end", () => {
  assert.equal(benchStepAtRoundBoundary(minimalSession({ turnIndex: 1, turnSequence: [] })), false);
  assert.equal(
    benchStepAtRoundBoundary(
      minimalSession({
        turnIndex: 2,
        turnSequence: [
          { placementId: "a", label: "A", slot: 0, isDecider: true },
          { placementId: "b", label: "B", slot: 0, isDecider: false },
        ],
      }),
    ),
    true,
  );
});

test("benchFightActive", () => {
  assert.equal(benchFightActive(null), false);
  assert.equal(benchFightActive(minimalSession()), true);
  assert.equal(benchFightActive(minimalSession({ combatEnded: true })), false);
});

test("benchCanEditRoster when no active fight", () => {
  assert.equal(benchCanEditRoster(null), true);
  assert.equal(benchCanEditRoster(minimalSession()), false);
  assert.equal(benchCanEditRoster(minimalSession({ combatEnded: true })), true);
});
