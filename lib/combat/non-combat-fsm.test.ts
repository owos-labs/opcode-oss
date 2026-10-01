import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalizationStore, raiseLocalization, writeIntelFacts } from "./localization.ts";
import {
  canInvestigateApproximate,
  createSquadRuntime,
  disobeyChance,
  GAIT_MOVE_MULT,
  hasHostileExactOrFull,
  pickNonCombatGait,
  pickSquadLeader,
  tickNonCombat,
  type LeaderCandidate,
  type SlaveCommand,
} from "./non-combat-fsm.ts";
import { shouldRebuildRooms, type EncounterNav, type HuntPatrolRoute } from "./patrol.ts";

const leader: LeaderCandidate = {
  id: "lead",
  difficulty: "professional",
  skillScore: 10,
  attrScore: 10,
  gearScore: 5,
  position: { x: 0, y: 0 },
};

const slave: LeaderCandidate = {
  id: "slave",
  difficulty: "newstupid",
  skillScore: 1,
  attrScore: 1,
  gearScore: 0,
  position: { x: 1, y: 0 },
};

const squad = [leader, slave];

const twoRooms: EncounterNav = {
  rooms: [
    { id: "room-0", centroid: { x: 2, y: 2 }, cells: [] },
    { id: "room-1", centroid: { x: 12, y: 2 }, cells: [] },
  ],
  graph: {
    nodes: [
      { id: "room-0", kind: "room", position: { x: 2, y: 2 }, roomId: "room-0" },
      { id: "room-1", kind: "room", position: { x: 12, y: 2 }, roomId: "room-1" },
    ],
    edges: [{ a: "room-0", b: "room-1" }],
  },
  bounds: { min: { x: 0, y: 0 }, max: { x: 16, y: 8 } },
};

const hunt: HuntPatrolRoute = {
  difficulty: "newstupid",
  waypoints: [
    { position: { x: 0, y: 0 }, role: "opposite" },
    { position: { x: 20, y: 0 }, role: "random" },
  ],
};

function tickSlave(over: Partial<Parameters<typeof tickNonCombat>[0]> = {}) {
  return tickNonCombat({
    unitId: "slave",
    position: { x: 1, y: 0 },
    difficulty: "newstupid",
    squad,
    huntRoute: hunt,
    patrolIndex: 0,
    rng: () => 0.99,
    ...over,
  });
}

test("with a leader, other same-faction units are slaves", () => {
  assert.equal(pickSquadLeader(squad), "lead");
  const runtime = createSquadRuntime([
    {
      unitId: "lead",
      factionId: "red",
      difficulty: "professional",
      position: { x: 0, y: 0 },
      skillScore: 10,
      attrScore: 10,
      gearScore: 5,
    },
    {
      unitId: "slave",
      factionId: "red",
      difficulty: "trained",
      position: { x: 1, y: 0 },
    },
  ]);
  assert.equal(runtime.leaderId, "lead");

  const asSlave = tickSlave();
  assert.equal(asSlave.isSlave, true);
  assert.equal(asSlave.leaderId, "lead");
  assert.equal(asSlave.state, "patrol");

  const asLead = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 0 },
    difficulty: "professional",
    squad,
    huntRoute: hunt,
    rng: () => 0.99,
  });
  assert.equal(asLead.isSlave, false);

  const bySkills = pickSquadLeader([
    { id: "a", difficulty: "trained", skillScore: 2, attrScore: 2, gearScore: 9 },
    { id: "b", difficulty: "trained", skillScore: 8, attrScore: 8, gearScore: 0 },
  ]);
  assert.equal(bySkills, "b");

  const override = pickSquadLeader(squad, "slave");
  assert.equal(override, "slave");
});

test("command occupies the slot and beats patrol; recon arrival and search-complete return to patrol", () => {
  const recon: SlaveCommand = { kind: "recon", point: { x: 8, y: 4 } };
  const onCommand = tickSlave({
    command: recon,
    state: "patrol",
  });
  assert.equal(onCommand.state, "recon");
  assert.deepEqual(onCommand.command, recon);
  assert.deepEqual(onCommand.destination, recon.point);
  assert.notEqual(onCommand.destination?.x, hunt.waypoints[0]!.position.x);

  const arrived = tickSlave({
    command: recon,
    position: recon.point,
  });
  assert.equal(arrived.state, "patrol");
  assert.equal(arrived.command, null);

  const searching = tickSlave({
    command: { kind: "search" },
    squad: [leader, { ...slave, command: { kind: "search" } }],
    nav: twoRooms,
    searchedRooms: ["room-0", "room-1"],
    position: { x: 0, y: 0 },
  });
  assert.equal(searching.state, "patrol");
  assert.equal(searching.command, null);
});

test("search completes only when all rooms are marked searched", () => {
  const searchSquad = [leader, { ...slave, command: { kind: "search" } as SlaveCommand }];
  const first = tickSlave({
    command: { kind: "search" },
    squad: searchSquad,
    nav: twoRooms,
    searchedRooms: [],
    position: { x: 2, y: 2 },
  });
  assert.equal(first.state, "search");
  assert.equal(first.command?.kind, "search");
  assert.equal(first.freeFire, true);
  assert.ok(first.searchedRooms.includes("room-0"));
  assert.equal(first.searchedRooms.includes("room-1"), false);

  const stillOpen = tickSlave({
    command: { kind: "search" },
    squad: searchSquad,
    nav: twoRooms,
    searchedRooms: ["room-0"],
    position: { x: 0, y: 0 },
  });
  assert.equal(stillOpen.state, "search");
  assert.equal(stillOpen.command?.kind, "search");

  const done = tickSlave({
    command: { kind: "search" },
    squad: searchSquad,
    nav: twoRooms,
    searchedRooms: ["room-0"],
    position: { x: 12, y: 2 },
  });
  assert.ok(done.searchedRooms.includes("room-0"));
  assert.ok(done.searchedRooms.includes("room-1"));
  assert.equal(done.state, "patrol");
  assert.equal(done.command, null);
  assert.equal(done.freeFire, false);
});

test("disobey clears the slot; next tick with no new command is patrol", () => {
  assert.equal(disobeyChance("newstupid"), 0.25);
  assert.equal(disobeyChance("professional"), 0);

  const recon: SlaveCommand = { kind: "recon", point: { x: 9, y: 9 } };
  const now = tickSlave({
    command: recon,
    rng: () => 0,
  });
  assert.equal(now.disobeyed, true);
  assert.equal(now.command, null);
  assert.equal(now.state, "patrol");

  const next = tickSlave({
    command: null,
    disobeyedLastTurn: true,
    newCommandThisTurn: false,
    rng: () => 0,
  });
  assert.equal(next.state, "patrol");
  assert.equal(next.command, null);
  assert.equal(next.disobeyed, false);
});

test("investigate empty lastKnownPosition with no new intel returns to patrol", () => {
  const lkp = { x: 5, y: 5 };
  const empty = tickNonCombat({
    unitId: "slave",
    position: lkp,
    difficulty: "professional",
    state: "investigate",
    lastKnownPosition: lkp,
    hasNewIntel: false,
    hostiles: [],
    squad,
    huntRoute: hunt,
    rng: () => 0.99,
  });
  assert.equal(empty.state, "patrol");
  assert.equal(empty.command, null);
});

test("no exact/full hostiles means not inCombat; exact/full does not invent combat actions", () => {
  assert.equal(hasHostileExactOrFull([{ targetId: "h", level: "approximate" }]), false);
  assert.equal(hasHostileExactOrFull([{ targetId: "h", level: "exact" }]), true);

  const fuzzy = tickSlave({
    hostiles: [
      {
        targetId: "h1",
        level: "approximate",
        lastKnownPosition: { x: 3, y: 3 },
        hasBeenCombatant: true,
      },
    ],
  });
  assert.equal(fuzzy.inCombat, false);
  assert.equal("actions" in fuzzy, false);

  const store = createLocalizationStore();
  raiseLocalization(store, "red", "h1", "approximate", { x: 3, y: 3 });
  const fromStore = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 0 },
    difficulty: "professional",
    squad,
    store,
    factionId: "red",
    hostileRefs: [{ id: "h1", position: { x: 3, y: 3 } }],
    rng: () => 0.99,
  });
  assert.equal(fromStore.inCombat, false);

  const fighting = tickSlave({
    command: { kind: "assist" },
    hostiles: [{ targetId: "h1", level: "full", lastKnownPosition: { x: 3, y: 3 } }],
  });
  assert.equal(fighting.inCombat, true);
  assert.equal(fighting.command?.kind, "assist");
  assert.equal("actions" in fighting, false);
});

const roomPatrol: HuntPatrolRoute = {
  difficulty: "professional",
  waypoints: [
    { position: { x: 8, y: 2 }, roomId: "rect-40", role: "room" },
    { position: { x: 14, y: 2 }, roomId: "rect-45", role: "room" },
    { position: { x: 20, y: 0 }, role: "opposite" },
  ],
};

const roomNav: EncounterNav = {
  rooms: [
    { id: "rect-40", centroid: { x: 8, y: 2 }, cells: [{ x: 8, y: 2 }] },
    { id: "rect-45", centroid: { x: 14, y: 2 }, cells: [{ x: 14, y: 2 }] },
  ],
  graph: {
    nodes: [
      { id: "rect-40", kind: "room", position: { x: 8, y: 2 }, roomId: "rect-40" },
      { id: "rect-45", kind: "room", position: { x: 14, y: 2 }, roomId: "rect-45" },
    ],
    edges: [{ a: "rect-40", b: "rect-45" }],
  },
  bounds: { min: { x: 0, y: 0 }, max: { x: 24, y: 8 } },
};

function emptyMap(walls: { a: { x: number; y: number }; b: { x: number; y: number } }[] = []) {
  return { mapId: "t", walls, barriers: [], emplacements: [] };
}

test("patrol clears a room when the interior is visible, without standing on the centroid", () => {
  const seen = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 2 },
    difficulty: "professional",
    state: "patrol",
    squad: [leader],
    huntRoute: roomPatrol,
    patrolIndex: 0,
    nav: roomNav,
    map: emptyMap(),
    rng: () => 0.99,
  });
  assert.equal(seen.patrolIndex, 2);
  assert.deepEqual(seen.destination, { x: 20, y: 0 });

  const blocked = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 2 },
    difficulty: "professional",
    state: "patrol",
    squad: [leader],
    huntRoute: roomPatrol,
    patrolIndex: 0,
    nav: roomNav,
    map: emptyMap([{ a: { x: 4, y: -2 }, b: { x: 4, y: 6 } }]),
    rng: () => 0.99,
  });
  assert.equal(blocked.patrolIndex, 0);
  assert.deepEqual(blocked.destination, { x: 8, y: 2 });
});

test("patrol does not bounce back into a room already visible from the corridor", () => {
  const bounce = tickNonCombat({
    unitId: "lead",
    position: { x: 11, y: 2 },
    difficulty: "professional",
    state: "patrol",
    squad: [leader],
    huntRoute: roomPatrol,
    patrolIndex: 0,
    nav: roomNav,
    map: emptyMap(),
    rng: () => 0.99,
  });
  assert.equal(bounce.patrolIndex, 2);
  assert.notEqual(bounce.destination?.x, 8);
  assert.notEqual(bounce.destination?.x, 14);
});

test("patrol-end path asks for room rebuild via shouldRebuildRooms", () => {
  assert.equal(shouldRebuildRooms("patrol-end"), true);
  const end = tickSlave({
    state: "patrol",
    position: hunt.waypoints[1]!.position,
    patrolIndex: 1,
    huntRoute: hunt,
  });
  assert.equal(end.state, "patrol");
  assert.equal(end.rebuildNav, true);
  assert.equal(end.rebuildNav, shouldRebuildRooms("patrol-end"));
  assert.equal(end.patrolIndex, 0);
});

test("trained may chase remaining approximate; novice does not auto-investigate", () => {
  assert.equal(canInvestigateApproximate("trained"), true);
  assert.equal(canInvestigateApproximate("novice"), false);

  const lkp = { x: 7, y: 1 };
  const trained = tickNonCombat({
    unitId: "t",
    position: { x: 0, y: 0 },
    difficulty: "trained",
    state: "patrol",
    lastKnownPosition: lkp,
    squad: [
      { id: "boss", difficulty: "professional", position: { x: 0, y: 0 } },
      { id: "t", difficulty: "trained", position: { x: 0, y: 0 } },
    ],
    hostiles: [{ targetId: "h", level: "approximate", lastKnownPosition: lkp, hasBeenCombatant: true }],
    rng: () => 0.99,
  });
  assert.equal(trained.inCombat, false);
  assert.equal(trained.state, "investigate");
  assert.deepEqual(trained.destination, lkp);

  const novice = tickNonCombat({
    unitId: "n",
    position: { x: 0, y: 0 },
    difficulty: "novice",
    state: "patrol",
    lastKnownPosition: lkp,
    squad: [
      { id: "boss", difficulty: "professional", position: { x: 0, y: 0 } },
      { id: "n", difficulty: "novice", position: { x: 0, y: 0 } },
    ],
    hostiles: [{ targetId: "h", level: "approximate", lastKnownPosition: lkp }],
    huntRoute: hunt,
    rng: () => 0.99,
  });
  assert.equal(novice.state, "patrol");
});

test("non-combat gait never exceeds 1x MOV", () => {
  assert.equal(GAIT_MOVE_MULT.run, 1);
  assert.ok(Object.values(GAIT_MOVE_MULT).every((m) => m <= 1));
  for (const difficulty of ["professional", "expert", "trained", "novice", "newstupid"] as const) {
    for (const gait of [
      pickNonCombatGait(difficulty, () => 0),
      pickNonCombatGait(difficulty, () => 0.4),
      pickNonCombatGait(difficulty, () => 0.99, { command: { kind: "assist" }, safeLos: true }),
    ]) {
      assert.ok(gait === "walk" || gait === "run");
    }
  }
});

test("professional off-combat gait is walk; store one-wall intel can interrupt patrol", () => {
  const walk = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 0 },
    difficulty: "professional",
    squad: [leader],
    huntRoute: hunt,
    rng: () => 0.99,
  });
  assert.equal(walk.gait, "walk");
  assert.equal(walk.isSlave, false);

  const store = createLocalizationStore();
  raiseLocalization(store, "red", "h1", "approximate", { x: 4, y: 0 });
  writeIntelFacts(store, "red", "h1", { oneWallShooterUntilMove: "exact" });
  const interrupted = tickNonCombat({
    unitId: "lead",
    position: { x: 0, y: 0 },
    difficulty: "professional",
    state: "patrol",
    lastKnownPosition: { x: 4, y: 0 },
    squad: [leader],
    store,
    factionId: "red",
    hostileRefs: [{ id: "h1", position: { x: 4, y: 0 } }],
    huntRoute: hunt,
    rng: () => 0.99,
  });
  assert.equal(interrupted.inCombat, false);
  assert.equal(interrupted.state, "investigate");
});
