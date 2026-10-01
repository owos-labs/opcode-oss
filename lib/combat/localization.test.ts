import assert from "node:assert/strict";
import { test } from "node:test";

import type { BallisticBarrier } from "../combat-ai/geometry.ts";
import {
  applyARangeMovement,
  applySRangeTouch,
  applySoundEvent,
  canImmediateDirectFire,
  capLocalizationByLos,
  createLocalizationStore,
  decayAfterWait,
  endWaitArmDecay,
  FUZZY_OFFSET_M,
  hearingRangeForSound,
  noteFullContact,
  noteTargetMoved,
  raiseLocalization,
  readProjectedIntel,
  senseRanges,
  setDecayFrozen,
  soundRangeAfterBarriers,
  tickLocalizationDecay,
  writeIntelFacts,
} from "./localization.ts";

test("fresh heard movement arms professional decay without unfreezing a conditional wait", () => {
  const store = createLocalizationStore();
  const target = { x: 8, y: 0 };
  const hear = () => applyARangeMovement({ store, observerFaction: "red", observerPos: { x: 0, y: 0 },
    hearingA: 24, difficulty: "professional", targetId: "blue", hasLos: false,
    track: { start: { x: 7, y: 0 }, path: [], end: target } });
  hear();
  for (let round = 0; round < 3; round++) {
    tickLocalizationDecay(store, "red", "blue", "professional", false);
    assert.equal(readProjectedIntel(store, "red", "blue", "professional", target).level, "exact");
  }
  tickLocalizationDecay(store, "red", "blue", "professional", false);
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", target).level, "approximate");
  setDecayFrozen(store, "red", "blue", true);
  hear();
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", target).decayFrozen, true);
});

const origin = { x: 0, y: 0 };
const targetPos = { x: 10, y: 0 };

test("exact may direct-fire; approximate cannot", () => {
  assert.equal(canImmediateDirectFire("exact"), true);
  assert.equal(canImmediateDirectFire("full"), true);
  assert.equal(canImmediateDirectFire("approximate"), false);
  assert.equal(canImmediateDirectFire("none"), false);
});

test("walls cap localization at exact", () => {
  assert.equal(capLocalizationByLos("full", false), "exact");
  assert.equal(capLocalizationByLos("full", true), "full");
  assert.equal(capLocalizationByLos("exact", false), "exact");
  const store = createLocalizationStore();
  const gained = raiseLocalization(store, "red", "blue", "full", targetPos, { hasLos: false });
  assert.equal(gained, "exact");
});

test("fuzzy report uses a sticky 2.5m offset that follows true position", () => {
  const store = createLocalizationStore();
  raiseLocalization(store, "red", "blue", "approximate", origin);
  const a = readProjectedIntel(store, "red", "blue", "trained", origin);
  assert.ok(a.fuzzyReportPoint);
  const mag = Math.hypot(a.fuzzyReportPoint!.x - origin.x, a.fuzzyReportPoint!.y - origin.y);
  assert.ok(Math.abs(mag - FUZZY_OFFSET_M) < 1e-6);
  const moved = { x: 8, y: 3 };
  const b = readProjectedIntel(store, "red", "blue", "trained", moved);
  assert.ok(b.fuzzyReportPoint);
  assert.ok(
    Math.abs(b.fuzzyReportPoint!.x - moved.x - (a.fuzzyReportPoint!.x - origin.x)) < 1e-9,
  );
  assert.ok(
    Math.abs(b.fuzzyReportPoint!.y - moved.y - (a.fuzzyReportPoint!.y - origin.y)) < 1e-9,
  );
});

test("faction members share the same intel record", () => {
  const store = createLocalizationStore();
  raiseLocalization(store, "red", "blue", "exact", targetPos, { hasLos: true });
  writeIntelFacts(store, "red", "blue", { outgoingDamage: 4, present: true });
  const ally = readProjectedIntel(store, "red", "blue", "trained", targetPos);
  assert.equal(ally.level, "exact");
  assert.equal(ally.outgoingDamage, 4);
});

test("first full loc grants mutual approximate to both factions", () => {
  const store = createLocalizationStore();
  noteFullContact(store, "red", "r1", { x: 0, y: 0 }, "blue", "b1", { x: 6, y: 0 }, true);
  const redOnBlue = readProjectedIntel(store, "red", "b1", "trained", { x: 6, y: 0 });
  const blueOnRed = readProjectedIntel(store, "blue", "r1", "trained", { x: 0, y: 0 });
  assert.equal(redOnBlue.level, "full");
  assert.equal(blueOnRed.level, "approximate");
  assert.equal(redOnBlue.hasBeenCombatant, true);
  assert.equal(blueOnRed.hasBeenCombatant, true);
});

test("sound range halves every 100 AR or 20 SSP", () => {
  assert.equal(hearingRangeForSound(20, "firearm"), 100);
  assert.equal(soundRangeAfterBarriers(100, [{ armorRating: 100, currentSsp: 0 }]), 50);
  assert.equal(soundRangeAfterBarriers(100, [{ armorRating: 0, currentSsp: 20 }]), 50);
  const wall: BallisticBarrier = {
    id: "w",
    a: { x: 5, y: -1 },
    b: { x: 5, y: 1 },
    armorRating: 100,
    maxSsp: 20,
    currentSsp: 0,
    blocksVision: true,
  };
  const store = createLocalizationStore();
  const heard = applySoundEvent({
    store,
    observerFaction: "red",
    observerPos: origin,
    hearingA: 20,
    difficulty: "trained",
    sourceId: "blue",
    sourcePos: { x: 40, y: 0 },
    kind: "firearm",
    barriers: [wall],
  });
  assert.equal(heard, true);
  const missed = applySoundEvent({
    store: createLocalizationStore(),
    observerFaction: "red",
    observerPos: origin,
    hearingA: 20,
    difficulty: "trained",
    sourceId: "blue",
    sourcePos: { x: 60, y: 0 },
    kind: "firearm",
    barriers: [wall],
  });
  assert.equal(missed, false);
});

test("awareness check outcome upgrades loc on a heard sound", () => {
  const store = createLocalizationStore();
  applySoundEvent({
    store,
    observerFaction: "red",
    observerPos: origin,
    hearingA: 20,
    difficulty: "trained",
    sourceId: "blue",
    sourcePos: { x: 8, y: 0 },
    kind: "footstep",
    barriers: [],
    awareness: "exact",
  });
  assert.equal(readProjectedIntel(store, "red", "blue", "trained", { x: 8, y: 0 }).level, "exact");
});

test("decay freezes during wait then applies N/M after", () => {
  assert.deepEqual(decayAfterWait("professional"), { exactRounds: 3, fuzzyRounds: 1, decays: true });
  const store = createLocalizationStore();
  raiseLocalization(store, "red", "blue", "exact", targetPos, { hasLos: true });
  markAndFreeze(store);
  setDecayFrozen(store, "red", "blue", true);
  for (let i = 0; i < 5; i++) tickLocalizationDecay(store, "red", "blue", "professional", false);
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", targetPos).level, "exact");
  endWaitArmDecay(store, "red", "blue", "professional");
  for (let i = 0; i < 3; i++) tickLocalizationDecay(store, "red", "blue", "professional", false);
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", targetPos).level, "exact");
  tickLocalizationDecay(store, "red", "blue", "professional", false);
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", targetPos).level, "approximate");
});

function markAndFreeze(store: ReturnType<typeof createLocalizationStore>): void {
  writeIntelFacts(store, "red", "blue", { present: true });
}

test("combatant floor stays approximate after fuzzy decay", () => {
  const store = createLocalizationStore();
  raiseLocalization(store, "red", "blue", "approximate", targetPos);
  store.records.get("red\0blue")!.hasBeenCombatant = true;
  endWaitArmDecay(store, "red", "blue", "trained");
  tickLocalizationDecay(store, "red", "blue", "trained", false);
  tickLocalizationDecay(store, "red", "blue", "trained", false);
  assert.equal(readProjectedIntel(store, "red", "blue", "trained", targetPos).level, "approximate");
});

test("newstupid at exact does not see HP; professional does", () => {
  const store = createLocalizationStore("hunt");
  raiseLocalization(store, "red", "blue", "exact", targetPos, { hasLos: true });
  writeIntelFacts(store, "red", "blue", {
    present: true,
    outgoingDamage: 6,
    initiative: 14,
    incomingDamage: 3,
    hitPoints: 40,
    gear: { weaponRangeM: 400 },
    combatMods: { attack: 2, defense: 1 },
  });
  const ns = readProjectedIntel(store, "red", "blue", "newstupid", targetPos);
  assert.equal(ns.level, "exact");
  assert.equal(ns.hitPoints, undefined);
  assert.equal(ns.initiative, undefined);
  assert.equal(ns.gear, undefined);
  assert.equal(ns.combatMods, undefined);
  assert.equal(ns.incomingDamage, 3);
  const expert = readProjectedIntel(store, "red", "blue", "expert", targetPos);
  assert.equal(expert.hitPoints, undefined);
  assert.deepEqual(expert.combatMods, { attack: 2, defense: 1 });
  const pro = readProjectedIntel(store, "red", "blue", "professional", targetPos);
  assert.equal(pro.hitPoints, 40);
  assert.equal(pro.initiative, 14);
  assert.equal(pro.gear?.weaponRangeM, 400);
  assert.deepEqual(pro.combatMods, { attack: 2, defense: 1 });
});

test("SENS splits A / open V / S from REF+WIL", () => {
  const r = senseRanges(6, 4);
  assert.equal(r.sens, 20);
  assert.equal(r.hearingA, 20);
  assert.equal(r.openVisionV, 200);
  assert.equal(r.passiveS, 10);
});

test("A-range movement and S-touch write loc per difficulty", () => {
  const store = createLocalizationStore();
  applyARangeMovement({
    store,
    observerFaction: "red",
    observerPos: origin,
    hearingA: 20,
    difficulty: "professional",
    targetId: "blue",
    track: { start: { x: 1, y: 0 }, path: [{ x: 2, y: 0 }], end: { x: 3, y: 0 } },
  });
  assert.equal(readProjectedIntel(store, "red", "blue", "professional", { x: 3, y: 0 }).level, "exact");
  applySRangeTouch({
    store,
    observerFaction: "red",
    observerPos: origin,
    passiveS: 10,
    difficulty: "professional",
    targetId: "blue2",
    targetPos: { x: 4, y: 0 },
  });
  assert.equal(readProjectedIntel(store, "red", "blue2", "professional", { x: 4, y: 0 }).level, "full");
});

test("one-wall A-range firearm loc clears after the shooter moves", () => {
  const wall: BallisticBarrier = {
    id: "w",
    a: { x: 5, y: -1 },
    b: { x: 5, y: 1 },
    armorRating: 10,
    maxSsp: 5,
    currentSsp: 5,
    blocksVision: true,
  };
  const store = createLocalizationStore();
  applySoundEvent({
    store,
    observerFaction: "red",
    observerPos: origin,
    hearingA: 20,
    difficulty: "expert",
    sourceId: "blue",
    sourcePos: { x: 8, y: 0 },
    kind: "firearm",
    barriers: [wall],
  });
  const before = readProjectedIntel(store, "red", "blue", "expert", { x: 8, y: 0 });
  assert.equal(before.oneWallShooterUntilMove, "approximate");
  noteTargetMoved(store, "red", "blue", { x: 9, y: 0 });
  const after = readProjectedIntel(store, "red", "blue", "expert", { x: 9, y: 0 });
  assert.equal(after.oneWallShooterUntilMove, undefined);
});
