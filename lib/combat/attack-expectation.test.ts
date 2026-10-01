import assert from "node:assert/strict";
import test from "node:test";
import { standardFireExpectation } from "./attack-expectation.ts";
import { expectedOpcodeDamage } from "./damage-roll.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";
import { hitsForStandardFire, planStandardFire } from "./fire-mode.ts";
import { resolveBenchStandardFire } from "./combat-bench-fire-damage.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { createLocalizationStore, raiseLocalization } from "./localization.ts";

test("moving into vision scores the known contact without mutating or following hidden intel", () => {
  const intel = createLocalizationStore();
  raiseLocalization(intel, "red", "hostile-1", "exact", { x: 10, y: 0 });
  const snapshot = defaultCombatSnapshot({ intel, factionId: "red", attackBonus: 14, visionRangeM: 20 });
  const target = { ...snapshot.targets[0]!, position: { x: 50, y: 0 }, localization: "exact" as const };
  const from = { x: 1, y: 0 };
  const before = structuredClone(intel);
  const predicted = standardFireExpectation(snapshot, [], from, target).damage;
  assert.ok(predicted > 0);
  assert.ok(standardFireExpectation(snapshot, [], snapshot.position, target).damage <= predicted);
  assert.equal(standardFireExpectation({ ...snapshot, visionRangeM: 5 }, [], from, target).damage, 0);
  const wall = { id: "wall", a: { x: 5, y: -2 }, b: { x: 5, y: 2 }, blocksVision: true, armorRating: 0, maxSsp: 100, currentSsp: 100 };
  assert.equal(standardFireExpectation(snapshot, [wall], from, target).damage, 0);
  assert.deepEqual(intel, before);
  raiseLocalization(intel, "red", "hostile-1", "full", { x: 10, y: 0 });
  const visible = standardFireExpectation(snapshot, [], from, target).damage;
  assert.equal(predicted, visible);
  assert.equal(standardFireExpectation({ ...snapshot, intel: undefined }, [], from, { ...target, localization: "approximate" }).damage, 0);
});

test("expectedDamagePerHit does not throw when maxHp is set without part rows", () => {
  const base = defaultCombatSnapshot({ throwable: undefined, hitPoints: 40, maxHp: 40, healthMode: "simple" });
  const view = { ...base.targets[0]!, armorByPart: {}, maxHp: 40, healthMode: "simple" as const };
  assert.ok(Number.isFinite(standardFireExpectation(base, [], base.position, view).damage));
});

test("standard expectation counts attack faces, damage expression, critical and action penalties", () => {
  const base = defaultCombatSnapshot({ throwable: undefined });
  const snapshot = { ...base, ammo: { ...base.ammo, penetration: 0, expectedDamageDice: 1, damageDiceExpr: "1d6" }, targets: [{ ...base.targets[0]!, armorByPart: {} }] };
  const score = (overrides = {}) => standardFireExpectation({ ...snapshot, ...overrides }, [], snapshot.position, snapshot.targets[0]!);
  assert.ok(Math.abs(score().damage - 2.45) < 1e-9);
  assert.equal(score({ attackBonus: 0 }).damage, 0);
  assert.ok(score({ declaredStandardActions: 2 }).damage < score().damage);
  assert.ok(score({ standardFiresThisRound: 1 }).damage < score().damage);
  const stronger = standardFireExpectation({ ...snapshot, ammo: { ...snapshot.ammo, damageDiceExpr: "1d6+10" } }, [], snapshot.position, snapshot.targets[0]!);
  assert.ok(stronger.damage > score().damage);
  assert.ok(Math.abs(expectedOpcodeDamage("1d6-4", 1, 1) - 7 / 6) < 1e-9);
});

test("automatic fire expectation enumerates the execution hit rule rather than assuming two hits", () => {
  const base = defaultCombatSnapshot({ attackBonus: 25, encounter: { profileId: "expert", allowNpcSurrender: false, surrenderThreshold: -Infinity } });
  const snapshot = { ...base, weapon: { ...base.weapon, availableFireModes: ["auto" as const] } };
  const expected = standardFireExpectation(snapshot, [], snapshot.position, snapshot.targets[0]!);
  const plan = planStandardFire(snapshot, 6, () => 0, {
    attackBonus: 25,
    hitDifficulty: 15,
  });
  let hits = 0;
  for (let face = 1; face <= 10; face++) hits += hitsForStandardFire({ mode: plan.mode, attackTotal: face + 25 - plan.walkFirePenalty, difficulty: 15, rounds: plan.rounds, walkFirePenalty: plan.walkFirePenalty }) / 10;
  assert.ok(hits > 2);
  assert.ok(plan.rounds < 15);
  assert.ok(Math.abs(expected.expectedHits - hits) < 1e-9);
});

test("fire at a stale exact location cannot follow an unseen target", () => {
  const intel = createLocalizationStore();
  raiseLocalization(intel, "red", "hostile-1", "exact", { x: 5, y: 0 });
  const snapshot = defaultCombatSnapshot({ intel, factionId: "red" });
  const map = { mapId: "open", walls: [], barriers: [], emplacements: [] };
  const payload = buildPlanningPayload(snapshot, map);
  const result = resolveBenchStandardFire({ snapshot, payload, map, action: { round: 0, kind: actionKindIndex("standard_fire"), tile: 0, target: 1, timing: "immediate" }, healthByPlacementId: { "hostile-1": { current: 40, max: 40 } }, actorLabel: "A", targetLabel: () => "B", attackBonus: 100, rng: () => 0.9 });
  assert.equal(result.healthByPlacementId["hostile-1"]?.current, 40);
  assert.match(result.lines[0]!, /最后已知位置/);
});
