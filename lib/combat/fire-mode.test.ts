import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";
import {
  autoHitsFromRoll,
  autoRoundsPerAction,
  expectedAutoHitCount,
  hitsForStandardFire,
  optimalAutoRounds,
  planStandardFire,
  walkYourFirePenalty,
  weaponRoundsPerRound,
} from "./fire-mode.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

test("autoHitsFromRoll closed-form matches 20 vs 15 accuracy −2", () => {
  // 20 hit, 15 hit, 10 miss → first miss at shot 3 → 2 hits
  assert.equal(autoHitsFromRoll(20, 15, 20, 5), 2);
  assert.equal(walkYourFirePenalty({ accuracy: -2, standardActionIndex: 0 }), 5);
});

test("walk-your-fire drops 3→2→1 by standard action", () => {
  assert.equal(walkYourFirePenalty({ accuracy: 1, standardActionIndex: 0 }), 2);
  assert.equal(walkYourFirePenalty({ accuracy: 1, standardActionIndex: 1 }), 1);
  assert.equal(walkYourFirePenalty({ accuracy: 1, standardActionIndex: 2 }), 0);
});

test("sustained auto into a new round still uses walk-your-fire on extra rounds", () => {
  const snapshot = defaultCombatSnapshot({
    standardActionsThisRound: 0,
    sustainedFire: { active: true, walkFireMalus: 0, token: 2 },
    weapon: {
      rangeM: 400,
      rateOfFire: 900,
      accuracy: 0,
      semiAutoOrBetter: true,
      availableFireModes: ["auto"],
      defaultFireMode: "auto",
    },
    ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 30 },
  });
  const plan = planStandardFire(snapshot, 10);
  assert.equal(plan.walkFirePenalty, 3);
  assert.equal(
    hitsForStandardFire({ ...plan, attackTotal: 17, difficulty: 15 }),
    1,
  );
});

test("ROF fields cap auto per action and per round", () => {
  assert.equal(autoRoundsPerAction(900), 15);
  assert.equal(weaponRoundsPerRound(900), 45);
  assert.equal(autoRoundsPerAction(20), 1);
});

test("optimalAutoRounds stops once expected hits saturate", () => {
  assert.equal(
    optimalAutoRounds({
      attackBonus: 10,
      difficulty: 15,
      walkFirePenalty: 3,
      maxRounds: 15,
    }),
    1,
  );
  assert.ok(
    expectedAutoHitCount({
      attackBonus: 10,
      difficulty: 15,
      walkFirePenalty: 3,
      rounds: 1,
    }) > 0,
  );
  assert.equal(
    expectedAutoHitCount({
      attackBonus: 25,
      difficulty: 15,
      walkFirePenalty: 3,
      rounds: optimalAutoRounds({
        attackBonus: 25,
        difficulty: 15,
        walkFirePenalty: 3,
        maxRounds: 15,
      }),
    }),
    expectedAutoHitCount({
      attackBonus: 25,
      difficulty: 15,
      walkFirePenalty: 3,
      rounds: 15,
    }),
  );
});

test("planStandardFire uses sheet mode/rof/mag: semi spends 1, auto sizes to dice", () => {
  const semi = planStandardFire(
    defaultCombatSnapshot({
      weapon: {
        rangeM: 400,
        rateOfFire: 750,
        accuracy: 0,
        semiAutoOrBetter: true,
        availableFireModes: ["semi"],
        defaultFireMode: "semi",
      },
    }),
    6,
  );
  assert.equal(semi.mode, "semi");
  assert.equal(semi.rounds, 1);

  const auto = planStandardFire(
    defaultCombatSnapshot({
      encounter: {
        profileId: "expert",
        allowNpcSurrender: false,
        surrenderThreshold: -Infinity,
        mission: "hunt",
      },
      weapon: {
        rangeM: 400,
        rateOfFire: 1200,
        accuracy: -2,
        semiAutoOrBetter: true,
        availableFireModes: ["semi", "auto"],
        defaultFireMode: "auto",
      },
      ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 30 },
    }),
    6,
  );
  assert.equal(auto.mode, "auto");
  assert.equal(auto.rounds, 20);
  assert.equal(auto.walkFirePenalty, 5);
  assert.equal(hitsForStandardFire({ ...auto, attackTotal: 20, difficulty: 15 }), 2);

  const sized = planStandardFire(
    defaultCombatSnapshot({
      attackBonus: 10,
      encounter: {
        profileId: "expert",
        allowNpcSurrender: false,
        surrenderThreshold: -Infinity,
        mission: "hunt",
      },
      weapon: {
        rangeM: 400,
        rateOfFire: 900,
        accuracy: 0,
        semiAutoOrBetter: true,
        availableFireModes: ["auto"],
        defaultFireMode: "auto",
      },
    }),
    6,
    () => 0,
    { attackBonus: 10, hitDifficulty: 15 },
  );
  assert.equal(sized.rounds, 1);
});

test("burst is one roll then rounds damage, semi is one of each", () => {
  const burst = planStandardFire(
    defaultCombatSnapshot({
      encounter: {
        profileId: "professional",
        allowNpcSurrender: false,
        surrenderThreshold: -Infinity,
        mission: "hunt",
      },
      weapon: {
        rangeM: 400,
        rateOfFire: 750,
        accuracy: 0,
        semiAutoOrBetter: true,
        availableFireModes: ["semi", "burst"],
        defaultFireMode: "burst",
        burstPoolOk: true,
      },
      ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 30 },
    }),
    40,
  );
  assert.equal(burst.mode, "burst");
  assert.equal(burst.rounds, 3);
  assert.equal(hitsForStandardFire({ ...burst, attackTotal: 16, difficulty: 15 }), 3);
  assert.equal(hitsForStandardFire({ ...burst, attackTotal: 10, difficulty: 15 }), 0);
});

test("applyPlanStepToSnapshot spends planned auto rounds from ROF", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "hostile-1"],
  } as PlanningPayload;
  const snap = defaultCombatSnapshot({
    encounter: {
      profileId: "expert",
      allowNpcSurrender: false,
      surrenderThreshold: -Infinity,
      mission: "hunt",
    },
    weapon: {
      rangeM: 400,
      rateOfFire: 600,
      accuracy: 0,
      semiAutoOrBetter: true,
      availableFireModes: ["auto"],
      defaultFireMode: "auto",
    },
    ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 30 },
  });
  const next = applyPlanStepToSnapshot(snap, payload, {
    round: 0,
    kind: actionKindIndex("standard_fire"),
    tile: 0,
    target: 1,
    timing: "immediate",
  });
  assert.equal(next.ammo.roundsInMagazine, 29);
  assert.equal(next.sustainedFire.active, true);
});
