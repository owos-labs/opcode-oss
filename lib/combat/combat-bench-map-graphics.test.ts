import assert from "node:assert/strict";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import {
  buildCombatBenchNavOverlay,
  buildCombatBenchPatrolPaths,
  buildCombatBenchPlanFireLegs,
  buildCombatBenchPlanMoveLegs,
  buildCombatBenchFsmHints,
  buildCombatBenchCoverMarks,
  buildCombatBenchLocMarks,
  coverMarkShortLabel,
  buildCombatBenchSenseRings,
  buildSquadLeaderPlacementIds,
  convexHullMeters,
  fsmStateLabel,
  locLevelShortLabel,
  mapScaleBarPx,
  niceMapScaleMeters,
  buildCombatBenchMoveDebugHints,
  markerDifficultyLabel,
  planFireKindLabel,
  svgArrowHeadPoints,
  buildCombatBenchWalkPreviews,
} from "./combat-bench-map-graphics.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import { compileCombatMap } from "./map-adapter/compile.ts";
import type { MapSegmentDto } from "./map-adapter/types.ts";
import { buildEncounterNav } from "./patrol.ts";
import type { CombatSnapshot } from "./snapshot.ts";

function placement(id: string, team: string, extras?: Partial<CombatMapPlacement>): CombatMapPlacement {
  return { id, sheetId: `sheet-${id}`, label: id, x: 0, y: 0, team, ...extras };
}

test("buildCombatBenchSenseRings uses SENS for A, SENS*10 for V, SENS/2 for S", () => {
  const sheet = {
    stats: { stats: { ref: { base: 6, mod: 0 }, wil: { base: 4, mod: 0 } } },
    status: {},
  } as CharacterSheet;
  const [ring] = buildCombatBenchSenseRings({
    placements: [placement("a", "hostile", { sheetId: "s" })],
    sheetById: new Map([["s", sheet]]),
    originByPlacementId: { a: { x: 3, y: 4 } },
  });
  assert.ok(ring);
  assert.equal(ring.origin.x, 3);
  assert.equal(ring.hearingA, 20);
  assert.equal(ring.openVisionV, 200);
  assert.equal(ring.passiveS, 10);
});

test("convexHullMeters keeps the outer square", () => {
  const hull = convexHullMeters([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
    { x: 1, y: 1 },
  ]);
  assert.equal(hull.length, 4);
  assert.ok(hull.every((p) => p.x === 0 || p.x === 2 || p.y === 0 || p.y === 2));
});

test("buildCombatBenchNavOverlay draws rooms and walk-clear patrol edges", () => {
  const walls = [
    { a: { x: 0, y: 0 }, b: { x: 0, y: 8 } },
    { a: { x: 0, y: 0 }, b: { x: 8, y: 0 } },
    { a: { x: 0, y: 8 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 8, y: 3 } },
    { a: { x: 8, y: 5 }, b: { x: 8, y: 8 } },
    { a: { x: 8, y: 0 }, b: { x: 16, y: 0 } },
    { a: { x: 8, y: 8 }, b: { x: 16, y: 8 } },
    { a: { x: 16, y: 0 }, b: { x: 16, y: 8 } },
  ];
  const segments: MapSegmentDto[] = walls.map((w, i) => ({
    id: `w${i}`,
    a: w.a,
    b: w.b,
    armorRating: 10,
    maxSsp: 10,
    currentSsp: 10,
    blocksVision: true,
  }));
  const overlay = buildCombatBenchNavOverlay(
    buildEncounterNav(compileCombatMap({ id: "pair", segments }), { pockets: true }),
  );
  assert.ok(overlay);
  assert.ok(overlay.rooms.length >= 2);
  assert.ok(overlay.rooms.every((room) => room.hull.length >= 3));
  assert.ok(overlay.nodes.some((n) => n.kind === "room"));
  assert.ok(overlay.nodes.some((n) => n.kind === "corner"));
  assert.ok(overlay.edges.length >= 1);
});

test("buildCombatBenchPatrolPaths skips short routes and keeps the current index", () => {
  const paths = buildCombatBenchPatrolPaths({
    placements: [placement("a", "hostile"), placement("b", "friendly")],
    fsmByPlacementId: {
      a: {
        patrolIndex: 1,
        huntRoute: {
          difficulty: "trained",
          waypoints: [
            { position: { x: 0, y: 0 }, role: "room" },
            { position: { x: 8, y: 0 }, role: "corner" },
            { position: { x: 8, y: 6 }, role: "opposite" },
          ],
        },
      },
      b: { patrolIndex: 0 },
    },
  });
  assert.equal(paths.length, 1);
  assert.equal(paths[0]!.placementId, "a");
  assert.equal(paths[0]!.waypoints.length, 3);
  assert.equal(paths[0]!.currentIndex, 1);
});

test("buildCombatBenchPlanMoveLegs and fire legs follow the planned tile/target", () => {
  const move = actionKindIndex("move");
  const fire = actionKindIndex("standard_fire");
  const snapshot = {
    position: { x: 0, y: 0 },
    mov: 10,
    metersMovedThisRound: 0,
    initiativeTotal: 20,
    initiativeRemaining: 20,
    targets: [
      {
        id: "enemy",
        position: { x: 10, y: 0 },
        localization: "full",
        armorByPart: {},
        coverId: null,
      },
    ],
    weapon: { rangeM: 40, rateOfFire: 10, accuracy: 0, semiAutoOrBetter: true },
    ammo: { penetration: 0, expectedDamageDice: 1, roundsInMagazine: 30 },
  } as CombatSnapshot;
  const payload = {
    stancePositions: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
    targetIds: [null, "enemy"],
  } as PlanningPayload;
  const plan: RoundPlan = {
    snapshotVersion: 1,
    randomSeed: 1,
    completedDepth: 2,
    totalUtility: 2,
    timedOut: false,
    actions: [
      { round: 0, kind: move, tile: 1, target: 0, timing: "immediate" },
      { round: 0, kind: fire, tile: 1, target: 1, timing: "immediate" },
    ],
  };
  const plans = { shooter: { snapshot, payload, plan } };
  const moves = buildCombatBenchPlanMoveLegs(plans);
  const fires = buildCombatBenchPlanFireLegs(plans);
  assert.equal(moves.length, 1);
  assert.equal(moves[0]!.placementId, "shooter");
  assert.equal(moves[0]!.to.x, 4);
  assert.equal(fires.length, 1);
  assert.equal(fires[0]!.kind, "standard_fire");
  assert.equal(fires[0]!.from.x, 4);
  assert.equal(fires[0]!.to.x, 10);
});

test("buildSquadLeaderPlacementIds elects one leader on multi-member teams only", () => {
  const weak = {
    stats: { stats: { ref: { base: 1, mod: 0 } } },
    status: {},
  } as CharacterSheet;
  const strong = {
    stats: {
      stats: { ref: { base: 8, mod: 0 } },
      skills: { base: { marksmanship: { value: 6 } } },
    },
    status: {},
  } as CharacterSheet;
  const leaders = buildSquadLeaderPlacementIds({
    placements: [
      placement("lead", "hostile", { sheetId: "strong", profileId: "professional" }),
      placement("wing", "hostile", { sheetId: "weak", profileId: "novice" }),
      placement("solo", "friendly", { sheetId: "weak", profileId: "trained" }),
    ],
    sheetById: new Map([
      ["strong", strong],
      ["weak", weak],
    ]),
  });
  assert.equal(leaders.has("lead"), true);
  assert.equal(leaders.has("wing"), false);
  assert.equal(leaders.has("solo"), false);
});

test("niceMapScaleMeters picks a readable tick for the map width", () => {
  assert.equal(niceMapScaleMeters(100), 20);
  assert.equal(niceMapScaleMeters(50), 10);
  assert.equal(niceMapScaleMeters(20), 5);
  assert.equal(mapScaleBarPx(10, 2, 0.5), 40);
});

test("buildCombatBenchCoverMarks prefers entered cover over nearby map cover", () => {
  const bag = {
    id: "bag",
    a: { x: 5, y: -1 },
    b: { x: 5, y: 1 },
    armorRating: 4,
    maxSsp: 20,
    currentSsp: 20,
    blocksVision: false,
    coverHeightBand: "half" as const,
  };
  const far = {
    ...bag,
    id: "far",
    a: { x: 20, y: -1 },
    b: { x: 20, y: 1 },
  };
  const entered = buildCombatBenchCoverMarks({
    placements: [placement("a", "hostile", { x: 4, y: 0 })],
    plansByPlacementId: {
      a: { snapshot: { position: { x: 4, y: 0 }, coverId: "far" } } as never,
    },
    barriers: [bag, far],
  });
  assert.equal(entered.length, 1);
  assert.equal(entered[0]!.kind, "entered");
  assert.equal(entered[0]!.coverId, "far");
  assert.equal(coverMarkShortLabel(entered[0]!), "掩体");

  const nearby = buildCombatBenchCoverMarks({
    placements: [placement("a", "hostile", { x: 6, y: 0 })],
    barriers: [bag, far],
  });
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0]!.kind, "map");
  assert.equal(nearby[0]!.coverId, "bag");
  assert.equal(coverMarkShortLabel(nearby[0]!), "近掩");

  const open = buildCombatBenchCoverMarks({
    placements: [placement("a", "hostile", { x: 12, y: 0 })],
    barriers: [bag],
  });
  assert.equal(open.length, 0);
});

test("buildCombatBenchLocMarks uses the selected observer snapshot", () => {
  const marks = buildCombatBenchLocMarks({
    observerId: "a",
    labelById: (id) => (id === "b" ? "Bot B" : id),
    plansByPlacementId: {
      a: {
        snapshot: {
          position: { x: 1, y: 2 },
          targets: [
            {
              id: "b",
              position: { x: 8, y: 4 },
              localization: "approximate",
              armorByPart: {},
              coverId: null,
            },
          ],
        },
      } as never,
    },
  });
  assert.equal(marks.length, 1);
  assert.equal(marks[0]!.targetLabel, "Bot B");
  assert.equal(marks[0]!.level, "approximate");
  assert.equal(locLevelShortLabel("full"), "完全");
});

test("buildCombatBenchFsmHints labels hunt patrol vs combat", () => {
  assert.equal(fsmStateLabel("patrol", false), "巡逻");
  assert.equal(fsmStateLabel("patrol", true), "接战");
  const hints = buildCombatBenchFsmHints({
    placements: [placement("a", "1")],
    fsmByPlacementId: {
      a: {
        state: "patrol",
        patrolIndex: 0,
        huntRoute: {
          difficulty: "professional",
          waypoints: [{ position: { x: 12.4, y: 22.1 }, role: "room" }],
        },
      },
    },
  });
  assert.match(hints[0]!.text, /巡逻/);
  assert.equal(hints[0]!.destination?.x, 12.4);
  assert.equal(planFireKindLabel("suppressive_fire"), "压制");
});

test("markerDifficultyLabel and svgArrowHeadPoints are readable overlay helpers", () => {
  assert.equal(markerDifficultyLabel("expert"), "专家");
  assert.equal(markerDifficultyLabel(undefined), "困难");
  const head = svgArrowHeadPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 2);
  assert.ok(head);
  assert.match(head, /^10,0 /);
});

test("buildCombatBenchMoveDebugHints explains a hold", () => {
  const fire = actionKindIndex("standard_fire");
  const hints = buildCombatBenchMoveDebugHints({
    a: {
      snapshot: {
        position: { x: 0, y: 0 },
        mov: 10,
        metersMovedThisRound: 0,
        coverId: null,
        encounter: { profileId: "expert" },
        targets: [],
        weapon: { rangeM: 40, rateOfFire: 10, accuracy: 0, semiAutoOrBetter: true },
        ammo: { penetration: 0, expectedDamageDice: 1, roundsInMagazine: 30 },
      },
      payload: {
        stancePositions: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
        targetIds: [null],
        shape: { initiativeRounds: 1, kinds: 10, reachableTiles: 2, targets: 1 },
        feasibility: { legal: new Uint8Array(20) },
        utility: new Float32Array(20),
      },
      plan: {
        snapshotVersion: 1,
        randomSeed: 1,
        completedDepth: 1,
        totalUtility: 1,
        timedOut: false,
        actions: [{ round: 0, kind: fire, tile: 0, target: 0, timing: "immediate" }],
      },
    } as never,
  });
  assert.equal(hints[0]!.placementId, "a");
  assert.match(hints[0]!.text, /^不移动：/);
});

test("buildCombatBenchWalkPreviews samples gait landings on the walked polyline", () => {
  const wall = [{ a: { x: 2, y: -4 }, b: { x: 2, y: 4 } }];
  const previews = buildCombatBenchWalkPreviews({
    placements: [placement("a", "1")],
    plansByPlacementId: {
      a: {
        snapshot: {
          position: { x: 0, y: 0 },
          mov: 6,
          targets: [],
        },
        payload: {
          stancePositions: [{ x: 0, y: 0 }],
          targetIds: [null],
          walls: wall,
        },
        plan: { snapshotVersion: 1, randomSeed: 1, completedDepth: 0, totalUtility: 0, timedOut: false, actions: [] },
      } as never,
    },
    fsmByPlacementId: {
      a: {
        state: "patrol",
        patrolIndex: 0,
        huntRoute: {
          difficulty: "professional",
          waypoints: [{ position: { x: 6, y: 0 }, role: "room" }],
        },
      },
    },
  });
  assert.equal(previews.length, 1);
  assert.ok(previews[0]!.polyline.length >= 3);
  assert.ok(previews[0]!.steps.length >= 2);
  assert.ok(previews[0]!.polyline.some((p) => Math.abs(p.y) > 0.1));
});
