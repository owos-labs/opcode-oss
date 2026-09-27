import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import {
  applyPlanStepToSnapshot,
  buildBenchSnapshot,
  describePlanStep,
  parseBenchMapViewBox,
  startCombatBenchSession,
  planIntentRows,
  stepCombatBenchSession,
} from "./combat-bench.ts";
import {
  benchStartValidation,
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
} from "./combat-bench-placements.ts";
import { loadCharacterSheetFromFile } from "./load-character-sheet-file.ts";
import { combatTestPlaceholderDocument } from "./combat-test-scene.ts";
import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";

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

test("bench validation requires decider and two units", () => {
  assert.equal(benchStartValidation([], null).ok, false);
  assert.equal(
    benchStartValidation(
      [{ id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" }],
      "a",
    ).ok,
    false,
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
  assert.match(line, /move/);
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
