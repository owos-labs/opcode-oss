import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { buildOpcodeInventoryStatus, createOpcodeInventoryDraft, readOpcodeInventory } from "../character-sheets/opcodeInventory.ts";
import { senseFromSheet } from "./bench-intel.ts";
import { ACTION_KINDS, actionKindIndex } from "../combat-ai/action-feasibility.ts";
import {
  applyPlanStepToSnapshot,
  buildBenchSnapshot,
  buildPlacementPlans,
  replanPlacementTurn,
  describePlanStep,
  parseBenchMapViewBox,
  startCombatBenchSession,
  planIntentRows,
  stepCombatBenchSession,
} from "./combat-bench.ts";
import { readProjectedIntel } from "./localization.ts";
import { combatMapWalkWalls, type CompiledCombatMap } from "./map-adapter/compile.ts";
import {
  benchStartValidation,
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
} from "./combat-bench-placements.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";
import {
  combatBenchMapMetersPerUnit,
  combatTestPlaceholderDocument,
  parseSvgViewBox,
} from "./combat-test-scene.ts";
import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { decideRoundPlan } from "../combat-ai/decide.ts";
import { bakeWalkWalls, stepAlongWalk, walkPathMeters } from "../combat-ai/walk-path.ts";
import { closestPointOnSegment } from "../combat-ai/geometry.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("svg percent ↔ meter roundtrip stays in bounds", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const viewBox = parseBenchMapViewBox(svg);
  assert.ok(viewBox);
  const meters = svgPercentToMeterPosition(40, 50, viewBox);
  const pct = meterPositionToMarkerPercent(meters.x, meters.y, viewBox);
  assert.ok(Math.abs(pct.leftPct - 40) < 0.01);
  assert.ok(Math.abs(pct.topPct - 50) < 0.01);
});

test("bench validation requires a decider and allows a solo bot", () => {
  assert.equal(benchStartValidation([], null).ok, false);
  assert.equal(
    benchStartValidation(
      [{ id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" }],
      "a",
    ).ok,
    true,
  );
});

test("buildBenchSnapshot uses character sheet weapon stats", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map<string, CharacterSheet>([[sheet.id, sheet]]);
  const placements = [
    { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile" as const },
    { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" as const },
  ];
  const snap = buildBenchSnapshot({
    sheetById: byId,
    placements,
    deciderPlacementId: "npc",
  });
  assert.equal(snap.weapon.rangeM, 350);
  assert.equal(snap.targets.length, 1);
  assert.equal(snap.targets[0]!.id, "tgt");
});

test("bench feeds live health and permitted attack stats into planning, preserving action count across slots", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map([[sheet.id, sheet]]);
  const placements = [
    { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile", profileId: "professional" as const },
    { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" },
  ];
  const map: CompiledCombatMap = { mapId: "open", walls: [], barriers: [], emplacements: [] };
  const health = { npc: { current: 12, max: 100 }, tgt: { current: 7, max: 100 } };
  const snapshot = buildBenchSnapshot({ sheetById: byId, placements, deciderPlacementId: "npc", profileId: "professional", map, healthByPlacementId: health });
  assert.equal(snapshot.hitPoints, 12);
  assert.equal(readProjectedIntel(snapshot.intel!, "hostile", "tgt", "professional", { x: 6, y: 0 }).hitPoints, 7);
  assert.equal(snapshot.targets[0]?.attackBonus, snapshot.attackBonus);
  const current = { ...snapshot, declaredStandardActions: 2, standardActionsThisRound: 1, standardFiresThisRound: 1, initiativeRemaining: 12 };
  const payload = buildPlanningPayload(current, map);
  const plan = decideRoundPlan({ profileId: "professional", feasibility: payload.feasibility, utility: payload.utility, randomSeed: 1, snapshotVersion: 1, maxStandardActions: payload.maxStandardActions });
  const replanned = replanPlacementTurn({ map, placements, sheetById: byId, placementId: "npc", prior: { snapshot: current, payload, plan }, randomSeed: 1, slot: 1, healthByPlacementId: health });
  assert.equal(replanned.snapshot.standardFiresThisRound, 1);
  assert.equal(replanned.snapshot.declaredStandardActions, 2);
  assert.ok(replanned.plan.actions.every(a => a.round >= 1));
  assert.ok(replanned.plan.actions.filter(a => ACTION_KINDS[a.kind] === "standard_fire").length <= 1);
});

test("stepCombatBenchSession advances move and updates position", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  const session = startCombatBenchSession({
    map,
    deciderPlacementId: "npc-1",
    placements: [
      { id: "npc-1", sheetId: "s", label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: "s", label: "T", x: 5, y: 0, team: "friendly" },
    ],
    sheetById: new Map(),
    randomSeed: 42,
  });
  assert.equal(session.combatEnded, false);
  if (session.turnSequence.length === 0) return;
  const first = stepCombatBenchSession(session, {
    map,
    placements: [
      { id: "npc-1", sheetId: "s", label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: "s", label: "T", x: 5, y: 0, team: "friendly" },
    ],
    sheetById: new Map(),
  });
  assert.notEqual(first.label, "done");
  assert.ok(first.session.turnIndex >= 1);
  assert.ok(first.actorPlacementId);
  assert.equal(first.done, false);
  assert.ok(first.session.stepLog.length >= 1);
});

test("stepping past turn sequence advances combat round instead of ending combat", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  let session = startCombatBenchSession({
    map,
    deciderPlacementId: "npc-1",
    placements: [
      { id: "npc-1", sheetId: "s", label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: "s", label: "T", x: 5, y: 0, team: "friendly" },
    ],
    sheetById: new Map(),
    randomSeed: 42,
  });
  const ctx = {
    map,
    placements: [
      { id: "npc-1", sheetId: "s", label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: "s", label: "T", x: 5, y: 0, team: "friendly" },
    ],
    sheetById: new Map(),
  };
  for (let i = 0; i < 500 && !session.combatEnded; i++) {
    const result = stepCombatBenchSession(session, ctx);
    session = result.session;
    if (result.newCombatRound !== undefined && result.newCombatRound > 1) break;
    if (result.done) break;
  }
  assert.ok(session.combatRound >= 2);
  assert.equal(session.combatEnded, false);
});

test("startCombatBenchSession uses the initiative roll as the action pool", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const session = startCombatBenchSession({
    map: openBenchMap(),
    deciderPlacementId: "npc",
    placements: [
      { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" },
    ],
    sheetById: new Map([[sheet.id, sheet]]),
    randomSeed: 42,
  });
  const entry = session.initiativeOrder.find((e) => e.placementId === "npc");
  assert.ok(entry);
  assert.equal(entry.d10Faces.length, 1);
  assert.equal(entry.initiativePool, entry.roll);
  assert.equal(entry.roll, entry.d10Faces[0]! + entry.ref + entry.initiativeBonus);
  assert.equal(session.plansByPlacementId.npc?.snapshot.initiativeTotal, entry.roll);
  assert.ok(entry.roll >= 6 && entry.roll <= 15);
});

test("startCombatBenchSession does not end a solo bot hunt", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const session = startCombatBenchSession({
    map,
    deciderPlacementId: "a",
    placements: [{ id: "a", sheetId: sheet.id, label: "A", x: 0, y: 0, team: "hostile" }],
    sheetById: new Map([[sheet.id, sheet]]),
    randomSeed: 1,
  });
  assert.equal(session.combatEnded, false);
  assert.ok(session.plansByPlacementId.a);
});

test("startCombatBenchSession does not end when custom teams are both alive", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg));
  const session = startCombatBenchSession({
    map,
    deciderPlacementId: "a",
    placements: [
      { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "alpha" },
      { id: "b", sheetId: "s", label: "B", x: 8, y: 0, team: "bravo" },
    ],
    sheetById: new Map(),
    randomSeed: 1,
  });
  assert.equal(session.combatEnded, false);
  assert.equal(session.endReason, null);
});

test("applyPlanStepToSnapshot decrements ammo on fire", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "hostile-1"],
  } as PlanningPayload;
  const snap = defaultCombatSnapshot({
    ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 10 },
  });
  const next = applyPlanStepToSnapshot(snap, payload, {
    round: 0,
    kind: actionKindIndex("standard_fire"),
    tile: 0,
    target: 1,
    timing: "immediate",
  });
  assert.equal(next.ammo.roundsInMagazine, 9);
});

test("applyPlanStepToSnapshot does not spend more suppress rounds than the magazine", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "hostile-1"],
  } as PlanningPayload;
  const snap = defaultCombatSnapshot({
    weapon: { rangeM: 350, rateOfFire: 900, accuracy: 0, semiAutoOrBetter: true },
    ammo: { penetration: 55, expectedDamageDice: 3, roundsInMagazine: 10 },
  });
  const next = applyPlanStepToSnapshot(snap, payload, {
    round: 0,
    kind: actionKindIndex("suppressive_fire"),
    tile: 0,
    target: 1,
    timing: "immediate",
  });
  assert.equal(next.ammo.roundsInMagazine, 0);
});

test("describePlanStep includes kind and timing", () => {
  const payload = {
    stancePositions: [{ x: 1, y: 2 }],
    targetIds: [null],
  } as PlanningPayload;
  const line = describePlanStep(payload, {
    round: 0,
    kind: actionKindIndex("move"),
    tile: 0,
    target: 0,
    timing: "immediate",
  });
  assert.match(line, /不移动/);
  assert.match(line, /immediate/);
});

test("planIntentRows lists one row per plan action", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "tgt-1"],
  } as PlanningPayload;
  const rows = planIntentRows(
    payload,
    {
      snapshotVersion: 1,
      randomSeed: 1,
      actions: [
        {
          round: 0,
          kind: actionKindIndex("standard_fire"),
          tile: 0,
          target: 1,
          timing: "immediate",
        },
      ],
      completedDepth: 1,
      totalUtility: 1,
      timedOut: false,
    },
    (id) => (id === "tgt-1" ? "Hostile" : ""),
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0]!.text, /Hostile/);
});

function wallBenchMap(): CompiledCombatMap {
  const wall = { a: { x: 3, y: -10 }, b: { x: 3, y: 10 } };
  return {
    mapId: "wall",
    walls: [wall],
    barriers: [
      {
        id: "w",
        a: wall.a,
        b: wall.b,
        armorRating: 0,
        maxSsp: 0,
        currentSsp: 0,
        blocksVision: true,
      },
    ],
    emplacements: [],
    solveBounds: { min: { x: -2, y: -2 }, max: { x: 10, y: 2 } },
  };
}

function openBenchMap(): CompiledCombatMap {
  return {
    mapId: "open",
    walls: [],
    barriers: [],
    emplacements: [],
    solveBounds: { min: { x: -2, y: -2 }, max: { x: 10, y: 2 } },
  };
}

test("buildBenchSnapshot does not seed full loc without a map", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map<string, CharacterSheet>([[sheet.id, sheet]]);
  const snap = buildBenchSnapshot({
    sheetById: byId,
    placements: [
      { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" },
    ],
    deciderPlacementId: "npc",
  });
  assert.ok(snap.intel);
  assert.equal(snap.factionId, "hostile");
  assert.equal(readProjectedIntel(snap.intel, "hostile", "tgt", "trained", { x: 6, y: 0 }).level, "none");
});

test("startCombatBenchSession shares passive intel through a wall without full vision", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map<string, CharacterSheet>([[sheet.id, sheet]]);
  const session = startCombatBenchSession({
    map: wallBenchMap(),
    deciderPlacementId: "npc",
    placements: [
      { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" },
    ],
    sheetById: byId,
    randomSeed: 1,
  });
  const npcPlan = session.plansByPlacementId.npc;
  assert.ok(npcPlan);
  assert.equal(npcPlan.snapshot.intel, session.intel);
  assert.equal(session.plansByPlacementId.tgt?.snapshot.intel, session.intel);
  assert.equal(readProjectedIntel(session.intel, "hostile", "tgt", "trained", { x: 6, y: 0 }).level, "exact");
});

test("startCombatBenchSession seeds full loc on open LOS and combat-decides", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const byId = new Map<string, CharacterSheet>([[sheet.id, sheet]]);
  const session = startCombatBenchSession({
    map: openBenchMap(),
    deciderPlacementId: "npc",
    placements: [
      { id: "npc", sheetId: sheet.id, label: "NPC", x: 0, y: 0, team: "hostile" },
      { id: "tgt", sheetId: sheet.id, label: "T", x: 6, y: 0, team: "friendly" },
    ],
    sheetById: byId,
    randomSeed: 1,
  });
  assert.equal(readProjectedIntel(session.intel, "hostile", "tgt", "trained", { x: 6, y: 0 }).level, "full");
  const kinds = session.plansByPlacementId.npc?.plan.actions.map((a) => ACTION_KINDS[a.kind]) ?? [];
  assert.ok(kinds.some((k) => k !== "move") || kinds.length > 0);
});

test("describePlanStep does not treat suppress tile as an aim point", () => {
  const line = describePlanStep(
    {
      stancePositions: [{ x: 2.9, y: 2.0 }],
      targetIds: [null],
    } as PlanningPayload,
    {
      round: 0,
      kind: actionKindIndex("suppressive_fire"),
      tile: 0,
      target: 0,
      timing: "immediate",
    },
  );
  assert.match(line, /suppressive_fire/);
  assert.doesNotMatch(line, /2\.9/);
});

test("hunt from a map corner steps toward a room instead of staying put", () => {
  const svg = readFileSync(join(fixtureDir, "fixtures/connected-walls.svg"), "utf8");
  const viewBox = parseSvgViewBox(svg);
  assert.ok(viewBox);
  const mpu = combatBenchMapMetersPerUnit("connected-walls", viewBox.w);
  const map = compileOpcodeMap(combatTestPlaceholderDocument(svg, "connected-walls", mpu));
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const start = { x: 61 * mpu, y: 42 * mpu };
  const session = startCombatBenchSession({
    map,
    deciderPlacementId: "a",
    placements: [
      {
        id: "a",
        sheetId: sheet.id,
        label: "A",
        x: start.x,
        y: start.y,
        team: "1",
        profileId: "professional",
      },
      {
        id: "b",
        sheetId: sheet.id,
        label: "B",
        x: 894 * mpu,
        y: 558 * mpu,
        team: "2",
        profileId: "professional",
      },
    ],
    sheetById: new Map([[sheet.id, sheet]]),
    randomSeed: 42,
  });
  const bundle = session.plansByPlacementId.a;
  assert.ok(bundle);
  const action = bundle.plan.actions[0];
  assert.ok(action);
  assert.equal(ACTION_KINDS[action.kind], "move");
  const dest = bundle.payload.stancePositions[action.tile];
  assert.ok(dest);
  assert.ok(Math.hypot(dest.x - start.x, dest.y - start.y) > 1);
});

function loadConnectedWallsMap() {
  const svg = readFileSync(join(fixtureDir, "fixtures/connected-walls.svg"), "utf8");
  const viewBox = parseSvgViewBox(svg);
  assert.ok(viewBox);
  const mpu = combatBenchMapMetersPerUnit("connected-walls", viewBox.w);
  return compileOpcodeMap(combatTestPlaceholderDocument(svg, "connected-walls", mpu));
}

function loadedSens24Sheet(opts?: { marksmanship?: number }) {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const stats = sheet.stats.stats as Record<string, { base: number }>;
  stats.ref!.base = 6;
  stats.wil!.base = 6;
  if (opts?.marksmanship != null) {
    const skills = sheet.stats.skills as { base: Record<string, { base: number }> };
    skills.base.marksmanship!.base = opts.marksmanship;
  }
  assert.equal(senseFromSheet(sheet).sens, 24);
  const drafts = readOpcodeInventory(sheet.status);
  const weapon = drafts.find(d => d.kind === "weapon")!;
  const magazine = createOpcodeInventoryDraft("magazine");
  const ammo = createOpcodeInventoryDraft("ammo");
  Object.assign(magazine.magazine!, { caliber: "5.56x45", containsMax: "30", loaded: "A".repeat(30), kinds: { A: ammo.id } });
  Object.assign(ammo.ammo!, { caliber: "5.56x45", penetration: "33", damage: "ball", ballDamage: { expression: "3d6+1" } });
  weapon.weapon!.magazineId = magazine.id;
  sheet.status = buildOpcodeInventoryStatus(sheet.status, [...drafts, magazine, ammo]);
  return sheet;
}

test("connected-walls car pursuit does not send the outnumbered professional back into the attackers", () => {
  const map = loadConnectedWallsMap();
  const sheet = loadedSens24Sheet();
  const placements = [
    { id: "pro", sheetId: sheet.id, label: "Pro", x: 3.9, y: 2.5, team: "1", profileId: "professional" as const },
    { id: "e1", sheetId: sheet.id, label: "Expert 1", x: 18.8, y: 2, team: "2", profileId: "expert" as const },
    { id: "e2", sheetId: sheet.id, label: "Expert 2", x: 19, y: 2.4, team: "2", profileId: "expert" as const },
  ];
  const ctx = { map, placements, sheetById: new Map([[sheet.id, sheet]]) };
  let session = startCombatBenchSession({ ...ctx, deciderPlacementId: "pro", randomSeed: 42 });
  assert.equal(session.plansByPlacementId.pro!.snapshot.visionRangeM, 240);
  let retreat: { x: number; y: number } | undefined;
  let held = false;
  const advanced = new Set<string>();
  for (let i = 0; i < 30 && !session.combatEnded; i++) {
    const step = stepCombatBenchSession(session, ctx);
    session = step.session;
    const log = session.stepLog.at(-1)!;
    const actorLabel = placements.find(p => p.id === step.actorPlacementId)!.label;
    if (log.actionDescriptions.some(line => line.includes("移动 ")) &&
      log.actionDescriptions.some(line => line.startsWith(`情报 ${actorLabel}（`) && line.includes("视V"))) {
      const shot = log.actionDescriptions.find(line => line.includes("射击检定："));
      if (shot) {
        assert.match(shot, /\+位0\+/, "a shot after gaining sight must not pay the stale exact-localization penalty");
      }
    }
    if (step.actorPlacementId === "pro") {
      if (retreat && !held) {
        assert.deepEqual(step.actorPosition, retreat, "after breaking contact, wait for a favorable fight instead of charging back");
        held = true;
      }
      if (log.actionDescriptions.some(line => line.includes("脱战："))) retreat = step.actorPosition;
    } else if (retreat && log.actionDescriptions.some(line => line.includes("移动 "))) advanced.add(step.actorPlacementId);
  }
  assert.ok(retreat && held, "exercise retreat and a subsequent round");
  assert.ok(advanced.size >= 1, "at least one pursuer must progress after the target withdraws");
});

// Reported hard-cover stalls: actual map, loaded character sheet, SENS 24 and live round logs.
for (const scenario of [
  { name: "two hard bots", a: { x: 12.4, y: 9.6, profileId: "trained" }, b: { x: 16.4, y: 10.3, profileId: "trained" } },
  { name: "expert and hard bot", a: { x: 14, y: 11.6, profileId: "expert" }, b: { x: 15.6, y: 10.3, profileId: "trained" } },
] as const) {
  test(`connected-walls ${scenario.name} resume combat across rounds instead of staying behind cover forever`, () => {
    const map = loadConnectedWallsMap();
    const walls = combatMapWalkWalls(map);
    const sheet = loadedSens24Sheet({ marksmanship: 14 });
    const placements = [
      { id: "a", sheetId: sheet.id, label: "A", team: "1", ...scenario.a },
      { id: "b", sheetId: sheet.id, label: "B", team: "2", ...scenario.b },
    ];
    const ctx = { map, placements, sheetById: new Map([[sheet.id, sheet]]) };
    let session = startCombatBenchSession({ ...ctx, deciderPlacementId: "a", randomSeed: 42 });
    for (const [id, bundle] of Object.entries(session.plansByPlacementId)) {
      assert.equal(bundle.snapshot.targets[0]!.localization, "exact", `${id} should begin with exact contact through cover`);
    }
    for (let i = 0; i < 40 && !session.combatEnded; i++) {
      const before = session;
      const result = stepCombatBenchSession(session, ctx);
      session = result.session;
      const bundle = session.plansByPlacementId[result.actorPlacementId]!;
      const from = before.plansByPlacementId[result.actorPlacementId]!.snapshot.position;
      const distance = walkPathMeters(from, result.actorPosition, walls);
      assert.notEqual(distance, null, "movement must follow a reachable route");
      assert.ok(distance! <= bundle.snapshot.mov * 1.5 + 1e-6);
      for (const wall of walls) {
        const near = closestPointOnSegment(result.actorPosition, wall);
        assert.ok(Math.hypot(near.x - result.actorPosition.x, near.y - result.actorPosition.y) > 1e-6, "bot must not land inside a wall edge");
      }
      assert.equal(session.randomSeed, 42, "initiative/replay seed stays unchanged");
      if (before.combatRound === session.combatRound) {
        assert.equal(bundle.plan.randomSeed, before.plansByPlacementId[result.actorPlacementId]!.plan.randomSeed, "same-round replan reuses its policy roll");
      }
    }
    const shots = session.stepLog.filter(e => e.actionDescriptions.some(line => line.includes("射击检定")));
    assert.ok(shots.length >= 1, JSON.stringify(session.stepLog));
    if (session.combatRound > 1) assert.ok(shots.some(e => e.combatRound > 1), "must keep fighting after the initial exchange");
    assert.equal(session.combatEnded, true, JSON.stringify(session.stepLog));
    assert.equal(session.endReason, "faction_eliminated");
  });
}

test("connected-walls northwest expert breaks contact with five visible southwest attackers", (t) => {
  const map = loadConnectedWallsMap();
  const sheet = loadedSens24Sheet();
  const placements = [
    { id: "expert", sheetId: sheet.id, label: "Expert", team: "1", profileId: "expert" as const, x: 1.2, y: 1 },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `attacker-${i}`, sheetId: sheet.id, label: `Attacker ${i}`, team: "2", profileId: "trained" as const, x: 0.7 + i * 0.35, y: 7.5 + i * 0.05 })),
  ];
  const ctx = { map, placements, sheetById: new Map([[sheet.id, sheet]]) };
  let session = startCombatBenchSession({ ...ctx, deciderPlacementId: "expert", randomSeed: 4 });
  const initial = session.plansByPlacementId.expert!.snapshot;
  assert.equal(initial.targets.length, 5);
  assert.ok(initial.targets.every(t => t.localization === "full"), "all five attackers must be visible at the start");
  assert.equal(initial.allyCount, 1);
  const first = stepCombatBenchSession(session, ctx);
  session = first.session;
  assert.equal(first.actorPlacementId, "expert");
  assert.notDeepEqual(first.actorPosition, initial.position);
  const distance = walkPathMeters(initial.position, first.actorPosition, combatMapWalkWalls(map));
  assert.ok(distance !== null && distance > 1 && distance <= initial.mov + 1e-6);
  assert.ok(session.stepLog[0]!.actionDescriptions.some(line => line.includes("脱战")), JSON.stringify(session.stepLog));
  assert.equal(session.stepLog[0]!.actionDescriptions.some(line => line.includes("射击检定")), false);
  for (let i = 0; i < 18 && !session.combatEnded; i++) session = stepCombatBenchSession(session, ctx).session;
  assert.ok(session.stepLog.length > 1, "run the actual attackers and subsequent turns too");
  t.diagnostic(JSON.stringify(session.stepLog.filter(e => e.actorPlacementId === "expert").map(e => ({ round: e.combatRound, position: e.actorPosition, actions: e.actionDescriptions }))));
});

test("policy rolls vary by actor and round and remain reproducible", () => {
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const ctx = {
    map: { mapId: "open", walls: [], barriers: [], emplacements: [] },
    sheetById: new Map([[sheet.id, sheet]]),
    placements: [
      { id: "a", sheetId: sheet.id, label: "A", team: "1", x: 0, y: 0 },
      { id: "b", sheetId: sheet.id, label: "B", team: "2", x: 6, y: 0 },
    ],
    randomSeed: 42,
  };
  const first = buildPlacementPlans({ ...ctx, combatRound: 1 });
  const next = buildPlacementPlans({ ...ctx, combatRound: 2 });
  const replay = buildPlacementPlans({ ...ctx, combatRound: 2 });
  assert.notEqual(first.plansByPlacementId.a!.plan.randomSeed, first.plansByPlacementId.b!.plan.randomSeed);
  assert.notEqual(first.plansByPlacementId.a!.plan.randomSeed, next.plansByPlacementId.a!.plan.randomSeed);
  assert.deepEqual(next.plansByPlacementId.a!.plan, replay.plansByPlacementId.a!.plan);
});

test("connected-walls bakes covering walls and a hunt step stays local", () => {
  const map = loadConnectedWallsMap();
  const raw = map.barriers.filter((b) => b.blocksVision).length;
  assert.ok(map.walls.length <= raw);
  assert.equal(bakeWalkWalls(map.walls).length, map.walls.length);
  const walls = combatMapWalkWalls(map);
  const t0 = performance.now();
  stepAlongWalk({ x: 1.2, y: 1.2 }, { x: 8, y: 5 }, walls, 3);
  assert.ok(performance.now() - t0 < 250);
});

/** East of the last yellow room, behind the x≈990 wall — not an authored room. */
function connectedWallsSePocket(map: CompiledCombatMap) {
  const b = map.solveBounds;
  assert.ok(b);
  return { x: b.max.x - 1.2, y: b.max.y - 1.2 };
}

test("connected-walls SE pocket is not a yellow room and cannot walk out", () => {
  const map = loadConnectedWallsMap();
  const pocket = connectedWallsSePocket(map);
  assert.ok((map.authoredRooms ?? []).every((r) => r.centroid.x < pocket.x - 1));
  const mpu = map.metersPerUnit ?? (1049 * 1.8) / 88 / 1049;
  const outside = { x: 400 * mpu, y: 250 * mpu };
  const walls = combatMapWalkWalls(map);
  assert.equal(walkPathMeters(pocket, outside, walls, { maxMeters: 80 }), null);
  assert.equal(walkPathMeters(outside, pocket, walls, { maxMeters: 80 }), null);
});

test("bot in connected-walls SE pocket stays inside while the other patrols", () => {
  const map = loadConnectedWallsMap();
  const pocket = connectedWallsSePocket(map);
  const sheet = loadCharacterSheetFromFile(join(fixtureDir, "fixtures/test-chr.json"));
  const placements = [
    {
      id: "trapped",
      sheetId: sheet.id,
      label: "Trapped",
      x: pocket.x,
      y: pocket.y,
      team: "1",
      profileId: "trained",
    },
    {
      id: "patrol",
      sheetId: sheet.id,
      label: "Patrol",
      x: 3,
      y: 3,
      team: "2",
      profileId: "trained",
    },
  ];
  const ctx = { map, placements, sheetById: new Map([[sheet.id, sheet]]) };
  let session = startCombatBenchSession({
    ...ctx,
    deciderPlacementId: "trapped",
    randomSeed: 7,
  });
  const mpu = map.metersPerUnit ?? 1.8 / 88;
  const wallX = 990 * mpu;
  const wallY = 492 * mpu;
  for (let i = 0; i < 3; i++) {
    session = stepCombatBenchSession(session, ctx).session;
    const trapped = session.plansByPlacementId.trapped?.snapshot.position;
    assert.ok(trapped);
    assert.ok(trapped.x > wallX - 0.4, `trapped walked out to ${trapped.x},${trapped.y}`);
    assert.ok(trapped.y > wallY - 0.4, `trapped walked out to ${trapped.x},${trapped.y}`);
    const patrol = session.plansByPlacementId.patrol?.snapshot.position;
    assert.ok(patrol);
    assert.equal(walkPathMeters(patrol, pocket, combatMapWalkWalls(map), { maxMeters: 80 }), null);
  }
});
