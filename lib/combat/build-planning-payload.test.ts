import assert from "node:assert/strict";
import { test } from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { decideRoundPlan } from "../combat-ai/decide.ts";
import { isStandardActionKindIndex } from "../combat-ai/search.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { compileCombatMap } from "./map-adapter/compile.ts";
import { createLocalizationStore, raiseLocalization, writeIntelFacts } from "./localization.ts";
import { defaultCombatSnapshot, loadSimpleMapFixture } from "./scenario-fixture.ts";
import { mapCoverBandOnLineOfEffect } from "./ranged-attack-cover.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import { standardFireExpectation } from "./attack-expectation.ts";

test("exact localization may fire; approximate cannot", () => {
  const map = compileCombatMap(loadSimpleMapFixture());
  const fire = actionKindIndex("standard_fire");
  const shapeFireLegal = (snap: ReturnType<typeof defaultCombatSnapshot>) => {
    const payload = buildPlanningPayload(snap, map);
    const { shape } = payload;
    for (let r = 0; r < shape.initiativeRounds; r++) {
      for (let t = 0; t < shape.reachableTiles; t++) {
        for (let g = 1; g < shape.targets; g++) {
          const idx = (((r * shape.kinds + fire) * shape.reachableTiles + t) * shape.targets + g);
          if (payload.feasibility.legal[idx] === 1) return true;
        }
      }
    }
    return false;
  };

  assert.equal(shapeFireLegal(defaultCombatSnapshot({
    targets: [{ id: "hostile-1", position: { x: 6, y: 0 }, localization: "exact", armorByPart: { torso: 25 }, coverId: null }],
  })), true);
  assert.equal(shapeFireLegal(defaultCombatSnapshot({
    targets: [{ id: "hostile-1", position: { x: 6, y: 0 }, localization: "approximate", armorByPart: { torso: 25 }, coverId: null }],
  })), false);
});

test("payload reads intel store loc, not a full snapshot cheat", () => {
  const map = compileCombatMap(loadSimpleMapFixture());
  const intel = createLocalizationStore("hunt");
  raiseLocalization(intel, "hostile", "hostile-1", "approximate", { x: 6, y: 0 });
  writeIntelFacts(intel, "hostile", "hostile-1", { hitPoints: 99, present: true });
  const snap = defaultCombatSnapshot({
    factionId: "hostile",
    intel,
    encounter: { profileId: "newstupid", allowNpcSurrender: false, surrenderThreshold: -Infinity, mission: "hunt" },
    targets: [{ id: "hostile-1", position: { x: 6, y: 0 }, localization: "full", armorByPart: { torso: 25 }, coverId: null }],
  });
  const payload = buildPlanningPayload(snap, map);
  const fire = actionKindIndex("standard_fire");
  const { shape } = payload;
  let fireLegal = false;
  for (let r = 0; r < shape.initiativeRounds; r++) {
    for (let t = 0; t < shape.reachableTiles; t++) {
      for (let g = 1; g < shape.targets; g++) {
        const idx = (((r * shape.kinds + fire) * shape.reachableTiles + t) * shape.targets + g);
        if (payload.feasibility.legal[idx] === 1) fireLegal = true;
      }
    }
  }
  assert.equal(fireLegal, false);
});

test("holding on an open map has zero movement utility", () => {
  const payload = buildPlanningPayload(defaultCombatSnapshot(), { mapId: "open", walls: [], barriers: [], emplacements: [] });
  const move = actionKindIndex("move");
  const { shape } = payload;
  const hold = (((0 * shape.kinds + move) * shape.reachableTiles + 0) * shape.targets + 0);
  assert.equal(payload.feasibility.legal[hold], 1);
  assert.equal(payload.utility[hold], 0);
});

function fireLegal(snap: ReturnType<typeof defaultCombatSnapshot>, rng?: () => number): boolean {
  const payload = buildPlanningPayload(snap, compileCombatMap(loadSimpleMapFixture()), rng);
  const fire = actionKindIndex("standard_fire");
  const { shape } = payload;
  for (let r = 0; r < shape.initiativeRounds; r++) {
    for (let t = 0; t < shape.reachableTiles; t++) {
      for (let g = 1; g < shape.targets; g++) {
        const idx = (((r * shape.kinds + fire) * shape.reachableTiles + t) * shape.targets + g);
        if (payload.feasibility.legal[idx] === 1) return true;
      }
    }
  }
  return false;
}

function encounter(profileId: "newstupid" | "novice" | "trained" | "expert" | "professional") {
  return { profileId, allowNpcSurrender: false, surrenderThreshold: -Infinity, mission: "hunt" as const };
}

function moveActionIndex(payload: ReturnType<typeof buildPlanningPayload>, tile: number): number {
  const move = actionKindIndex("move");
  const { shape } = payload;
  return (((0 * shape.kinds + move) * shape.reachableTiles + tile) * shape.targets + 0);
}

test("newstupid novice trained cannot legalize fuzzy standard_fire", () => {
  const fuzzy = {
    id: "hostile-1",
    position: { x: 6, y: 0 },
    localization: "approximate" as const,
    armorByPart: { torso: 25 },
    coverId: null,
  };
  for (const profileId of ["newstupid", "novice", "trained"] as const) {
    assert.equal(
      fireLegal(defaultCombatSnapshot({
        encounter: encounter(profileId),
        weapon: { ...defaultCombatSnapshot().weapon, canPenCover: true },
        targets: [fuzzy],
      })),
      false,
    );
  }
});

test("professional can legalize fuzzy fire when canPenCover or grenade", () => {
  const fuzzy = {
    id: "hostile-1",
    position: { x: 6, y: 0 },
    localization: "approximate" as const,
    armorByPart: { torso: 25 },
    coverId: null,
  };
  assert.equal(
    fireLegal(defaultCombatSnapshot({
      encounter: encounter("professional"),
      weapon: { ...defaultCombatSnapshot().weapon, canPenCover: true },
      throwable: undefined,
      targets: [fuzzy],
    })),
    true,
  );
  assert.equal(
    fireLegal(defaultCombatSnapshot({
      encounter: encounter("professional"),
      weapon: { ...defaultCombatSnapshot().weapon, canPenCover: false },
      throwable: { rangeM: 30, expectedDamageDice: 2 },
      targets: [fuzzy],
    })),
    true,
  );
});

test("expert exact plus penCover is treated as line of effect", () => {
  assert.equal(
    fireLegal(defaultCombatSnapshot({
      encounter: encounter("expert"),
      weapon: { ...defaultCombatSnapshot().weapon, canPenCover: true },
      targets: [{
        id: "hostile-1",
        position: { x: 6, y: 0 },
        localization: "exact",
        armorByPart: { torso: 25 },
        coverId: null,
      }],
    })),
    true,
  );
});

test("action-cap payload: trained at most 2 standards, expert at most 3", () => {
  const trained = buildPlanningPayload(
    defaultCombatSnapshot({
      encounter: encounter("trained"),
      initiativeRemaining: 99,
    }),
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.ok(trained.maxStandardActions <= 2);
  assert.ok(trained.shape.initiativeRounds <= 2);

  const expert = buildPlanningPayload(
    defaultCombatSnapshot({
      encounter: encounter("expert"),
      initiativeRemaining: 99,
    }),
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.ok(expert.maxStandardActions <= 3);
  assert.ok(expert.shape.initiativeRounds <= 3);
});

test("unlocated ambush adds an extra standard slot; located path is conditional instead", () => {
  const unlocated = buildPlanningPayload(
    defaultCombatSnapshot({
      encounter: encounter("professional"),
      targets: [],
    }),
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.equal(unlocated.locatedPathConditional, false);
  assert.equal(unlocated.maxStandardActions, 2);

  const located = buildPlanningPayload(
    defaultCombatSnapshot({
      encounter: encounter("professional"),
      locatedPathAmbush: true,
      targets: [{
        id: "hostile-1",
        position: { x: 6, y: 0 },
        localization: "exact",
        armorByPart: { torso: 25 },
        coverId: null,
      }],
    }),
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.equal(located.locatedPathConditional, true);
  assert.ok(located.maxStandardActions <= 3);
});

test("trained/expert/newstupid payload+search honor standard-action caps", () => {
  const map = compileCombatMap(loadSimpleMapFixture());
  const trained = defaultCombatSnapshot({ encounter: encounter("trained"), initiativeRemaining: 99 });
  const trainedPayload = buildPlanningPayload(trained, map);
  const trainedPlan = decideRoundPlan({
    profileId: "trained",
    feasibility: trainedPayload.feasibility,
    utility: trainedPayload.utility,
    randomSeed: 1,
    snapshotVersion: trained.snapshotVersion,
    maxStandardActions: trainedPayload.maxStandardActions,
  });
  assert.ok(trainedPlan.actions.filter(a => isStandardActionKindIndex(a.kind)).length <= 2);

  const expert = defaultCombatSnapshot({ encounter: encounter("expert"), initiativeRemaining: 99 });
  const expertPayload = buildPlanningPayload(expert, map);
  const expertPlan = decideRoundPlan({
    profileId: "expert",
    feasibility: expertPayload.feasibility,
    utility: expertPayload.utility,
    randomSeed: 1,
    snapshotVersion: expert.snapshotVersion,
    maxStandardActions: expertPayload.maxStandardActions,
  });
  assert.ok(expertPlan.actions.filter(a => isStandardActionKindIndex(a.kind)).length <= 3);

  const stupid = defaultCombatSnapshot({ encounter: encounter("newstupid") });
  const stupidPayload = buildPlanningPayload(stupid, map);
  const stupidPlan = decideRoundPlan({
    profileId: "newstupid",
    feasibility: stupidPayload.feasibility,
    utility: stupidPayload.utility,
    randomSeed: 1,
    snapshotVersion: stupid.snapshotVersion,
    maxStandardActions: stupidPayload.maxStandardActions,
  });
  const move = actionKindIndex("move");
  const hasMove = stupidPlan.actions.some(a => a.kind === move);
  const hasStandard = stupidPlan.actions.some(a => isStandardActionKindIndex(a.kind));
  assert.equal(hasMove && hasStandard, false);
});

test("located path may intercept from here or move and fire immediately", () => {
  const snap = defaultCombatSnapshot({
    encounter: encounter("professional"),
    locatedPathAmbush: true,
    targets: [{
      id: "hostile-1",
      position: { x: 6, y: 0 },
      localization: "exact",
      armorByPart: { torso: 25 },
      coverId: null,
    }],
  });
  const payload = buildPlanningPayload(snap, compileCombatMap(loadSimpleMapFixture()));
  assert.equal(payload.locatedPathConditional, true);
  const plan = decideRoundPlan({
    profileId: "professional",
    feasibility: payload.feasibility,
    utility: payload.utility,
    randomSeed: 1,
    snapshotVersion: snap.snapshotVersion,
    maxStandardActions: payload.maxStandardActions,
    locatedPathConditional: payload.locatedPathConditional,
  });
  const fire = actionKindIndex("standard_fire");
  const thrown = actionKindIndex("throw");
  const suppress = actionKindIndex("suppressive_fire");
  for (const act of plan.actions) {
    if (act.kind === fire || act.kind === thrown || act.kind === suppress) {
      assert.equal(act.timing, act.tile === 0 ? "conditional" : "immediate");
      if (act.timing === "conditional") assert.equal(plan.actions.some(a => a.kind === actionKindIndex("move") && a.tile !== 0), false);
    }
  }
});

test("a losing bot finds nearby cover omitted by radial sampling and shoots only from its landing", () => {
  const base = defaultCombatSnapshot({ throwable: undefined, attackBonus: 0, allyCount: 1, encounter: encounter("expert") });
  const snapshot = { ...base, targets: [{ ...base.targets[0]!, position: { x: 30, y: 0 }, attackBonus: 20 }] };
  const cover = { id: "half", a: { x: 3, y: 0.5 }, b: { x: 3, y: 1.5 }, armorRating: 15, maxSsp: 100, currentSsp: 100, coverHeightBand: "half" as const, blocksVision: false };
  const map = { mapId: "cover", walls: [], barriers: [cover], emplacements: [] };
  const payload = buildPlanningPayload(snapshot, map);
  const plan = decideRoundPlan({ profileId: snapshot.encounter.profileId, feasibility: payload.feasibility, utility: payload.utility, randomSeed: 1, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
  assert.ok(move && move.tile !== 0);
  const landing = payload.stancePositions[move.tile]!;
  assert.equal(mapCoverBandOnLineOfEffect({ shooter: snapshot.targets[0]!.position, target: landing, targetEnteredCoverId: null, barriers: [cover] }), "half");
  assert.ok(Math.hypot(landing.x, landing.y) < 4);
  let actual = snapshot;
  for (const action of plan.actions) {
    if (action.kind === actionKindIndex("standard_fire")) assert.deepEqual(payload.stancePositions[action.tile], actual.position);
    actual = applyPlanStepToSnapshot(actual, payload, action) as typeof snapshot;
  }
});

test("planning prefers an affordable useful shot count and never combines a sprint with fire", () => {
  const base = defaultCombatSnapshot({ throwable: undefined, attackBonus: 10 });
  const snapshot = { ...base, weapon: { ...base.weapon, semiAutoOrBetter: false, rangeM: 20 }, targets: [{ ...base.targets[0]!, position: { x: 25, y: 0 }, attackBonus: 0 }] };
  const payload = buildPlanningPayload(snapshot, { mapId: "open", walls: [], barriers: [], emplacements: [] });
  const plan = decideRoundPlan({ profileId: "trained", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
  const fires = plan.actions.filter(a => a.kind === actionKindIndex("standard_fire"));
  assert.ok(fires.length > 0);
  for (const fire of fires) assert.equal(fire.tile, move?.tile ?? 0);
  if (move) assert.ok(Math.hypot(payload.stancePositions[move.tile]!.x, payload.stancePositions[move.tile]!.y) <= snapshot.mov);
});

test("a threatened expert enters nearby cover and does not fire through its own concealment", () => {
  const base = defaultCombatSnapshot({ throwable: undefined, expectedToBeKilled: true, encounter: encounter("expert") });
  const cover = { id: "bag", a: { x: 3, y: -3 }, b: { x: 3, y: 3 }, armorRating: 15, maxSsp: 100, currentSsp: 100, coverHeightBand: "half" as const, blocksVision: false };
  const map = { mapId: "cover", walls: [], barriers: [cover], emplacements: [] };
  const payload = buildPlanningPayload(base, map);
  const plan = decideRoundPlan({ profileId: "expert", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 1, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  assert.ok(plan.actions.some(a => a.kind === actionKindIndex("enter_cover")));
  assert.equal(plan.actions.some(a => a.kind === actionKindIndex("standard_fire")), false);
  let result = base;
  for (const action of plan.actions) result = applyPlanStepToSnapshot(result, payload, action);
  assert.equal(result.coverId, "bag");
});

test("an outmatched expert retreats from five known attackers instead of trading shots", () => {
  const base = defaultCombatSnapshot({ encounter: encounter("expert"), throwable: undefined, attackBonus: 6, allyCount: 1, hitPoints: 19 });
  const targets = Array.from({ length: 5 }, (_, i) => ({ ...base.targets[0]!, id: `enemy-${i}`,
    position: { x: 8, y: i - 2 }, armorByPart: {}, attackBonus: 6, damagePerHit: 10.5 }));
  const map = { mapId: "open", walls: [], barriers: [], emplacements: [] };
  for (const [allyCount, enemyAttack, shouldRetreat] of [[1, 6, true], [5, 6, false], [1, -20, false]] as const) {
    const snapshot = { ...base, allyCount, targets: targets.map(t => ({ ...t, attackBonus: enemyAttack })) };
    const payload = buildPlanningPayload(snapshot, map);
    const plan = decideRoundPlan({ profileId: "expert", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
    if (!shouldRetreat) {
      assert.equal(payload.movementReason, undefined);
      assert.ok(plan.actions.some(a => isStandardActionKindIndex(a.kind)), "numbers alone must not force retreat from a winnable fight");
      continue;
    }
    const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
    assert.ok(move && move.tile > 0, "expert must make an escape move");
    const landing = payload.stancePositions[move.tile]!;
    assert.ok(landing.x < -1, `must move away from the attackers, got ${JSON.stringify(landing)}`);
    assert.equal(plan.actions.some(a => isStandardActionKindIndex(a.kind)), false, "retreat takes priority over fire utility");
    assert.ok(Math.hypot(landing.x, landing.y) <= snapshot.mov + 1e-6);
  }
});

test("an advancing bot prefers usable firing cover over an exposed point-blank shot", () => {
  const cover = { id: "half", a: { x: 4, y: -1 }, b: { x: 4, y: 1 }, armorRating: 15, maxSsp: 100, currentSsp: 100, coverHeightBand: "half" as const, blocksVision: false };
  const map = { mapId: "advance", walls: [], barriers: [cover], emplacements: [] };
  for (const profileId of ["trained", "expert", "professional"] as const) {
    const base = defaultCombatSnapshot({ encounter: encounter(profileId), throwable: undefined, attackBonus: 12, allyCount: 5 });
    const snapshot = { ...base, weapon: { ...base.weapon, availableFireModes: ["auto"] as const },
      targets: [{ ...base.targets[0]!, position: { x: 10, y: 0 }, armorByPart: {}, attackBonus: 6 }] };
    const payload = buildPlanningPayload(snapshot, map);
    const plan = decideRoundPlan({ profileId, feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
    const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
    assert.ok(move && move.tile > 0);
    assert.equal(payload.coverIds?.[move.tile], "half", `${profileId} must stop at firing cover`);
    assert.ok(plan.actions.some(a => a.kind === actionKindIndex("standard_fire") && a.tile === move.tile));
    const landing = payload.stancePositions[move.tile]!;
    assert.ok(Math.hypot(landing.x - 10, landing.y) > 2.5, "do not bypass useful cover to reach point blank");
    const next = buildPlanningPayload({ ...snapshot, position: landing }, map);
    const continued = decideRoundPlan({ profileId, feasibility: next.feasibility, utility: next.utility, randomSeed: 42, snapshotVersion: 2, maxStandardActions: next.maxStandardActions });
    assert.equal(continued.actions.find(a => a.kind === actionKindIndex("move"))?.tile ?? 0, 0, "keep firing from useful cover instead of creeping toward the enemy every round");
  }
});

test("disengaged bots hold safe positions and reconsider when the fight improves", () => {
  const wall = { id: "wall", a: { x: 2, y: -2 }, b: { x: 2, y: 2 }, armorRating: 100, maxSsp: 100, currentSsp: 100, blocksVision: true };
  const map = { mapId: "disengage", walls: [wall], barriers: [wall], emplacements: [] };
  for (const profileId of ["expert", "professional"] as const) {
    const base = defaultCombatSnapshot({ encounter: encounter(profileId), throwable: undefined, attackBonus: 6, visionRangeM: 240, disengaging: true });
    const snapshot = { ...base, targets: [0, 1].map(i => ({ ...base.targets[0]!, id: `enemy-${i}`, position: { x: 8, y: i }, localization: "exact" as const, armorByPart: {}, attackBonus: 6 })) };
    const payload = buildPlanningPayload(snapshot, map, () => 0);
    const plan = decideRoundPlan({ profileId, feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
    assert.equal(payload.disengaging, true);
    assert.equal(plan.actions.find(a => a.kind === actionKindIndex("move"))?.tile ?? 0, 0);
    assert.match(payload.movementReason!, /脱战后守候/);
    assert.equal(buildPlanningPayload({ ...snapshot, allyCount: 2 }, map).disengaging, false, "support ends the headcount disadvantage");
    assert.equal(buildPlanningPayload({ ...snapshot, attackBonus: 30,
      targets: snapshot.targets.map((t, i) => ({ ...t, position: { x: 0, y: 6 + i }, localization: "full" as const })) }, map).disengaging, false, "a favorable exchange allows retaliation even while outnumbered");
  }
});

test("reposition incentives reward covered tiles that regain line of fire", () => {
  const cover = { id: "half", a: { x: 4, y: -1 }, b: { x: 4, y: 1 }, armorRating: 15, maxSsp: 100, currentSsp: 100, coverHeightBand: "half" as const, blocksVision: false };
  const map = { mapId: "advance", walls: [], barriers: [cover], emplacements: [] };
  const base = defaultCombatSnapshot({ encounter: encounter("professional"), throwable: undefined, attackBonus: 12, allyCount: 5 });
  const snapshot = { ...base, weapon: { ...base.weapon, availableFireModes: ["auto"] as const },
    targets: [{ ...base.targets[0]!, position: { x: 10, y: 0 }, armorByPart: {}, attackBonus: 6 }] };
  const payload = buildPlanningPayload(snapshot, map);
  let bestMove = -Infinity;
  for (let tile = 1; tile < payload.stancePositions.length; tile++) {
    const idx = moveActionIndex(payload, tile);
    if (payload.feasibility.legal[idx] === 1) bestMove = Math.max(bestMove, payload.utility[idx]!);
  }
  assert.ok(bestMove > 0, "有视野掩体位应获得掩体还击效用奖励");
  assert.match(payload.movementReason!, /推进：选择可还击的掩体/);
});

test("a flank fallback advances to the firing corner instead of one metre from the enemy", () => {
  const wall = { a: { x: 3, y: -2 }, b: { x: 3, y: 2 } };
  const map = { mapId: "corner", walls: [wall], barriers: [], emplacements: [] };
  const base = defaultCombatSnapshot({ encounter: encounter("professional"), throwable: undefined, attackBonus: -100 });
  const snapshot = { ...base, targets: [{ ...base.targets[0]!, position: { x: 6, y: 0 }, attackBonus: -100 }] };
  const payload = buildPlanningPayload(snapshot, map);
  const plan = decideRoundPlan({ profileId: "professional", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
  assert.ok(move && move.tile > 0);
  const landing = payload.stancePositions[move.tile]!;
  assert.ok(Math.hypot(landing.x - 6, landing.y) > 2.5, `must stop before rushing the enemy: ${JSON.stringify(landing)}`);
  assert.ok(Math.abs(landing.y) > 2, "reach a clear corner around the wall");
});

test("a safe expert does not advance to cover that exposes it to stronger return fire", () => {
  const half = { id: "half", a: { x: 4, y: -1 }, b: { x: 4, y: 1 }, armorRating: 15, maxSsp: 100, currentSsp: 100, coverHeightBand: "half" as const, blocksVision: false };
  const wall = { ...half, id: "wall", a: { x: 2, y: -2 }, b: { x: 2, y: 2 }, armorRating: 100, coverHeightBand: "full" as const, blocksVision: true };
  const map = { mapId: "safe-hold", walls: [wall], barriers: [wall, half], emplacements: [] };
  const base = defaultCombatSnapshot({ encounter: encounter("expert"), throwable: undefined, attackBonus: 12 });
  const snapshot = { ...base, targets: [{ ...base.targets[0]!, position: { x: 8, y: 0 }, localization: "exact" as const, armorByPart: {}, attackBonus: 30, damagePerHit: 20 }] };
  assert.ok(standardFireExpectation(snapshot, map.barriers, { x: 3.5, y: 0 }, snapshot.targets[0]!).damage > 0, "the exposed cover must actually permit return fire");
  const payload = buildPlanningPayload(snapshot, map, () => 1);
  const plan = decideRoundPlan({ profileId: "expert", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  assert.equal(plan.actions.find(a => a.kind === actionKindIndex("move"))?.tile ?? 0, 0);
});

test("an open approach still closes an unusable range without targeting the enemy's feet", () => {
  const base = defaultCombatSnapshot({ encounter: encounter("professional"), throwable: undefined, attackBonus: 6 });
  const snapshot = { ...base, weapon: { ...base.weapon, rangeM: 20 },
    targets: [{ ...base.targets[0]!, position: { x: 60, y: 0 }, attackBonus: -100 }] };
  const payload = buildPlanningPayload(snapshot, { mapId: "open", walls: [], barriers: [], emplacements: [] });
  const plan = decideRoundPlan({ profileId: "professional", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 42, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  const move = plan.actions.find(a => a.kind === actionKindIndex("move"));
  assert.ok(move && move.tile > 0, "lack of a wall corner must not stall an out-of-range approach");
  assert.deepEqual(payload.stancePositions[move.tile], { x: snapshot.mov, y: 0 });
});
