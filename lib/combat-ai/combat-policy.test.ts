import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  canDeclareUnlocatedAmbush,
  canDifficultyFireAtLoc,
  canTreatFuzzyAsFireable,
  concealWhenExpectedKilled,
  countsAsLineOfEffect,
  defaultHitExpectedValue,
  hitExpectedPositive,
  isThrowOrSuppressLegalForFuzzy,
  locatedPathAmbushPolicy,
  maxStandardActionsThisRound,
  preferredAimPlan,
  preferredFireMode,
  preferredHitLocation,
  suppressiveFirePlanningUtility,
  shouldReroll,
  shouldThrowBack,
  spendLuckReroll,
} from "./combat-policy.ts";

const always = () => 0;
const never = () => 1;

test("newstupid novice trained cannot fire at fuzzy loc", () => {
  for (const difficulty of ["newstupid", "novice", "trained"] as const) {
    assert.equal(
      canDifficultyFireAtLoc(difficulty, "approximate", { canPenCover: true, grenade: true }),
      false,
    );
  }
});

test("professional treats fuzzy as fireable when canPenCover or grenade", () => {
  assert.equal(canTreatFuzzyAsFireable(true, false), true);
  assert.equal(canTreatFuzzyAsFireable(false, true), true);
  assert.equal(canTreatFuzzyAsFireable(false, false), false);
  assert.equal(
    canDifficultyFireAtLoc("professional", "approximate", { canPenCover: true, grenade: false }),
    true,
  );
  assert.equal(
    canDifficultyFireAtLoc("professional", "approximate", { canPenCover: false, grenade: true }),
    true,
  );
  assert.equal(
    canDifficultyFireAtLoc("professional", "approximate", { canPenCover: false, grenade: false }),
    false,
  );
});

test("expert exact plus penCover counts as line of effect (Q15)", () => {
  assert.equal(
    countsAsLineOfEffect("expert", "exact", { canPenCover: true, grenade: false }),
    true,
  );
  assert.equal(canDifficultyFireAtLoc("expert", "exact", { canPenCover: true, grenade: false }), true);
  assert.equal(canDifficultyFireAtLoc("expert", "approximate", { canPenCover: true, grenade: true }), false);
});

test("action caps: trained 2, expert 3, professional initiative-bound when hit-EV positive", () => {
  assert.equal(
    maxStandardActionsThisRound({
      difficulty: "trained",
      hitEvPositive: true,
      initiativeBound: 6,
    }),
    2,
  );
  assert.equal(
    maxStandardActionsThisRound({
      difficulty: "expert",
      hitEvPositive: true,
      initiativeBound: 9,
    }),
    3,
  );
  assert.equal(
    maxStandardActionsThisRound({
      difficulty: "professional",
      hitEvPositive: true,
      initiativeBound: 5,
    }),
    5,
  );
  assert.equal(
    maxStandardActionsThisRound({
      difficulty: "newstupid",
      hitEvPositive: true,
      initiativeBound: 4,
    }),
    1,
  );
});

test("unlocated ambush grants an extra first-round standard; located path does not", () => {
  assert.equal(canDeclareUnlocatedAmbush("professional", "none"), true);
  assert.equal(canDeclareUnlocatedAmbush("professional", "approximate"), false);
  assert.equal(canDeclareUnlocatedAmbush("expert", "none"), false);
  assert.equal(
    maxStandardActionsThisRound({
      difficulty: "professional",
      hitEvPositive: false,
      extraAmbushStandard: true,
      initiativeBound: 1,
    }),
    2,
  );
  const located = locatedPathAmbushPolicy("professional");
  assert.equal(located.extraRound, false);
  assert.equal(located.timing, "conditional");
  assert.equal(locatedPathAmbushPolicy("expert").declareAmbush, false);
  assert.equal(locatedPathAmbushPolicy("trained").allowThrowSuppress, false);
});

test("professional LUK: two rerolls spend 2 points; newstupid never rerolls", () => {
  const first = spendLuckReroll(4);
  const second = spendLuckReroll(first.lukLeft);
  assert.equal(first.rerolled, true);
  assert.equal(second.rerolled, true);
  assert.equal(second.lukLeft, 2);
  assert.equal(shouldReroll(true, true), true);
  assert.equal(shouldReroll(false, true), false);
});

test("hit-EV uses heads for trained and below, dice EV for expert+", () => {
  assert.equal(defaultHitExpectedValue(0.5, 4), 2);
  assert.equal(
    hitExpectedPositive({
      difficulty: "trained",
      passProbability: 0,
      expectedDamageDice: 0,
      hostileCount: 1,
    }),
    true,
  );
  assert.equal(
    hitExpectedPositive({
      difficulty: "expert",
      passProbability: 0,
      expectedDamageDice: 6,
      hostileCount: 4,
    }),
    false,
  );
});

test("expert fuzzy throw/suppress is a 0.25 RNG gate", () => {
  assert.equal(isThrowOrSuppressLegalForFuzzy("expert", always), true);
  assert.equal(isThrowOrSuppressLegalForFuzzy("expert", never), false);
  assert.equal(isThrowOrSuppressLegalForFuzzy("trained", always), false);
  assert.equal(isThrowOrSuppressLegalForFuzzy("professional", never), true);
});

test("suppressiveFirePlanningUtility yields to direct fire when exact targets are shootable", () => {
  const raw = 8;
  const direct = 2.5;
  assert.equal(
    suppressiveFirePlanningUtility({
      difficulty: "expert",
      rawUtility: raw,
      bestDirectFireUtility: direct,
      allFuzzy: false,
      losing: false,
      rng: always,
    }),
    0,
  );
  assert.equal(
    suppressiveFirePlanningUtility({
      difficulty: "professional",
      rawUtility: raw,
      bestDirectFireUtility: direct,
      allFuzzy: false,
      losing: false,
      rng: always,
    }),
    0,
  );
  assert.equal(
    suppressiveFirePlanningUtility({
      difficulty: "expert",
      rawUtility: raw,
      bestDirectFireUtility: direct,
      allFuzzy: false,
      losing: true,
      rng: always,
    }),
    raw - direct,
  );
  assert.equal(
    suppressiveFirePlanningUtility({
      difficulty: "expert",
      rawUtility: raw,
      bestDirectFireUtility: direct,
      allFuzzy: false,
      losing: true,
      rng: never,
    }),
    0,
  );
});

test("fire-mode throw-back aim conceal tables follow difficulty text", () => {
  const modes = ["semi", "auto", "burst"] as const;
  assert.equal(
    preferredFireMode({
      difficulty: "newstupid",
      available: modes,
      defaultFireMode: "auto",
      poolAllowsBurst: true,
      exactEnemyCount: 2,
      distanceM: 1,
      weaponRangeM: 400,
      rng: always,
    }),
    "auto",
  );
  assert.equal(
    preferredFireMode({
      difficulty: "novice",
      available: modes,
      defaultFireMode: "auto",
      poolAllowsBurst: true,
      exactEnemyCount: 2,
      distanceM: 1,
      weaponRangeM: 400,
      rng: always,
    }),
    "semi",
  );
  assert.equal(
    preferredFireMode({
      difficulty: "professional",
      available: modes,
      defaultFireMode: "semi",
      poolAllowsBurst: true,
      exactEnemyCount: 2,
      distanceM: 40,
      weaponRangeM: 400,
      rng: never,
    }),
    "burst",
  );
  assert.equal(
    preferredFireMode({
      difficulty: "expert",
      available: modes,
      defaultFireMode: "semi",
      poolAllowsBurst: false,
      exactEnemyCount: 1,
      distanceM: 40,
      weaponRangeM: 400,
      rng: never,
    }),
    "auto",
  );
  assert.equal(shouldThrowBack("professional", true, never), true);
  assert.equal(shouldThrowBack("expert", true, always), true);
  assert.equal(shouldThrowBack("trained", true, always), true);
  assert.equal(shouldThrowBack("novice", true, always), false);
  assert.equal(preferredAimPlan({
    difficulty: "professional",
    hitEvPositive: true,
    keyKill: true,
    rng: never,
  }).rounds, 2);
  assert.equal(preferredAimPlan({
    difficulty: "expert",
    hitEvPositive: true,
    keyKill: true,
    rng: never,
  }).target, "center_mass");
  assert.equal(preferredAimPlan({
    difficulty: "newstupid",
    hitEvPositive: true,
    keyKill: true,
    rng: always,
  }).rounds, 0);
  assert.equal(concealWhenExpectedKilled("professional", true, never), "conceal");
  assert.equal(concealWhenExpectedKilled("newstupid", true, always), "none");
  assert.equal(preferredHitLocation({
    difficulty: "novice",
    hitEvPositive: true,
    canPenArmor: true,
    immediatelyLethal: true,
    rng: always,
  }), "none");
});

test("P3 modules do not import deleted simulation search or lethalityFocus", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const files = [
    "combat-policy.ts",
    "planning.ts",
    "search.ts",
    "decide.ts",
    join("..", "combat", "build-planning-payload.ts"),
  ];
  for (const file of files) {
    const src = readFileSync(join(dir, file), "utf8");
    assert.equal(src.includes("decideRoundPlanWithSimulation"), false, file);
    assert.equal(src.includes("lethalityFocus"), false, file);
    assert.equal(src.includes("stateful-plan-search"), false, file);
  }
});
