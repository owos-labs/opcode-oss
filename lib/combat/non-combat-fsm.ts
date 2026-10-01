import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { mulberry32 } from "../combat-ai/planning.ts";
import { hasLineOfSight, type Vec2 } from "../combat-ai/visibility.ts";
import {
  locRank,
  readProjectedIntel,
  type LocalizationStore,
  type ProjectedIntel,
} from "./localization.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import {
  buildEncounterNav,
  buildHuntPatrolRoute,
  canSeeRoomInterior,
  shouldRebuildRooms,
  type EncounterNav,
  type HuntPatrolRoute,
} from "./patrol.ts";
import { visionWalls } from "./rooms.ts";

/** Non-combat FSM only. Combat sub-tactics are P3, not states (Q4). */
export type NonCombatState = "patrol" | "investigate" | "search" | "assist" | "recon";

/** 0.5x walk, 1x run. Footstep sound ignores the multiplier. */
export type MovementGait = "walk" | "run";

export const GAIT_MOVE_MULT: Record<MovementGait, number> = {
  walk: 0.5,
  run: 1,
};

export type SlaveCommand =
  | { kind: "search" }
  | { kind: "assist" }
  | { kind: "recon"; point: Vec2 };

export type LeaderCandidate = {
  id: string;
  difficulty: NpcDifficultyId;
  skillScore?: number;
  attrScore?: number;
  gearScore?: number;
  position?: Vec2;
  command?: SlaveCommand | null;
};

export type HostileView = Pick<
  ProjectedIntel,
  | "targetId"
  | "level"
  | "lastKnownPosition"
  | "present"
  | "hasBeenCombatant"
  | "movementTrack"
  | "oneWallShooterUntilMove"
  | "knownCombatLocation"
> & {
  truePos?: Vec2;
};

export type SquadUnitRuntime = {
  unitId: string;
  factionId: string;
  difficulty: NpcDifficultyId;
  position: Vec2;
  state: NonCombatState;
  command: SlaveCommand | null;
  patrolIndex: number;
  huntRoute?: HuntPatrolRoute;
  lastKnownPosition?: Vec2;
  disobeyedLastTurn: boolean;
  skillScore?: number;
  attrScore?: number;
  gearScore?: number;
};

export type SquadRuntime = {
  leaderId: string | null;
  searchedRooms: string[];
  units: SquadUnitRuntime[];
};

export type TickNonCombatInput = {
  unitId: string;
  position: Vec2;
  difficulty: NpcDifficultyId;
  state?: NonCombatState;
  command?: SlaveCommand | null;
  squad: readonly LeaderCandidate[];
  leaderIdOverride?: string;
  hostiles?: readonly HostileView[];
  store?: LocalizationStore;
  factionId?: string;
  hostileRefs?: readonly { id: string; position: Vec2 }[];
  huntRoute?: HuntPatrolRoute;
  patrolIndex?: number;
  lastKnownPosition?: Vec2;
  hasNewIntel?: boolean;
  searchedRooms?: readonly string[];
  nav?: EncounterNav;
  map?: CompiledCombatMap;
  rng?: () => number;
  issuedCommand?: SlaveCommand | null;
  newCommandThisTurn?: boolean;
  disobeyedLastTurn?: boolean;
  safeLos?: boolean;
  leaderPosition?: Vec2;
};

export type TickNonCombatResult = {
  state: NonCombatState;
  command: SlaveCommand | null;
  gait: MovementGait;
  destination?: Vec2;
  rebuildNav: boolean;
  inCombat: boolean;
  isSlave: boolean;
  leaderId: string | null;
  freeFire: boolean;
  disobeyed: boolean;
  patrolIndex: number;
  searchedRooms: string[];
  huntRoute?: HuntPatrolRoute;
  nav?: EncounterNav;
};

const ARRIVE_M = 0.75;

const DIFFICULTY_RANK: Record<NpcDifficultyId, number> = {
  newstupid: 0,
  novice: 1,
  trained: 2,
  expert: 3,
  professional: 4,
};

export function disobeyChance(difficulty: NpcDifficultyId): number {
  if (difficulty === "newstupid") return 0.25;
  if (difficulty === "novice") return 0.2;
  if (difficulty === "trained") return 0.1;
  if (difficulty === "expert") return 0.05;
  return 0;
}

export function hasHostileExactOrFull(hostiles: readonly HostileView[]): boolean {
  return hostiles.some((h) => h.level === "exact" || h.level === "full");
}

export function canInvestigateApproximate(difficulty: NpcDifficultyId): boolean {
  return difficulty === "professional" || difficulty === "expert" || difficulty === "trained";
}

function atPoint(a: Vec2, b: Vec2, eps = ARRIVE_M): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= eps;
}

function roomWaypointCleared(
  input: TickNonCombatInput,
  waypoint: HuntPatrolRoute["waypoints"][number],
): boolean {
  if (waypoint.role !== "room") return atPoint(input.position, waypoint.position);
  const walls = input.map ? visionWalls(input.map) : [];
  const room = waypoint.roomId
    ? input.nav?.rooms.find((r) => r.id === waypoint.roomId)
    : undefined;
  if (room) return canSeeRoomInterior(input.position, room, walls);
  return hasLineOfSight(input.position, waypoint.position, walls);
}

function leaderKey(c: LeaderCandidate): [number, number, number, string] {
  return [
    DIFFICULTY_RANK[c.difficulty],
    (c.skillScore ?? 0) + (c.attrScore ?? 0),
    c.gearScore ?? 0,
    c.id,
  ];
}

/** Highest difficulty, then skills+attrs, then gear. Manual id override wins (spec §Leader). */
export function pickSquadLeader(
  squad: readonly LeaderCandidate[],
  overrideId?: string,
): string | null {
  if (squad.length === 0) return null;
  if (overrideId && squad.some((u) => u.id === overrideId)) return overrideId;
  let best = squad[0]!;
  for (let i = 1; i < squad.length; i++) {
    const u = squad[i]!;
    const a = leaderKey(u);
    const b = leaderKey(best);
    if (a[0] !== b[0]) {
      if (a[0] > b[0]) best = u;
      continue;
    }
    if (a[1] !== b[1]) {
      if (a[1] > b[1]) best = u;
      continue;
    }
    if (a[2] !== b[2]) {
      if (a[2] > b[2]) best = u;
      continue;
    }
    if (a[3] < b[3]) best = u;
  }
  return best.id;
}

export function createSquadRuntime(
  units: Array<
    Omit<SquadUnitRuntime, "state" | "command" | "patrolIndex" | "disobeyedLastTurn"> &
      Partial<Pick<SquadUnitRuntime, "state" | "command" | "patrolIndex" | "disobeyedLastTurn">>
  >,
  opts?: { leaderId?: string },
): SquadRuntime {
  const candidates: LeaderCandidate[] = units.map((u) => ({
    id: u.unitId,
    difficulty: u.difficulty,
    skillScore: u.skillScore,
    attrScore: u.attrScore,
    gearScore: u.gearScore,
    position: u.position,
  }));
  return {
    leaderId: pickSquadLeader(candidates, opts?.leaderId),
    searchedRooms: [],
    units: units.map((u) => ({
      ...u,
      state: u.state ?? "patrol",
      command: u.command ?? null,
      patrolIndex: u.patrolIndex ?? 0,
      disobeyedLastTurn: u.disobeyedLastTurn ?? false,
    })),
  };
}

function resolveHostiles(input: TickNonCombatInput): HostileView[] {
  if (input.hostiles) return [...input.hostiles];
  if (input.store && input.factionId && input.hostileRefs) {
    return input.hostileRefs.map((h) =>
      readProjectedIntel(input.store!, input.factionId!, h.id, input.difficulty, h.position),
    );
  }
  return [];
}

/** Q5: this difficulty's patrol-detection list, using projected intel as the signal. */
export function patrolDetectionInterrupt(
  difficulty: NpcDifficultyId,
  hostiles: readonly HostileView[],
): boolean {
  for (const h of hostiles) {
    if (h.level === "none" || !h.level) continue;
    if (difficulty === "professional") {
      if (h.level === "approximate" && h.hasBeenCombatant) return true;
      if (h.level === "exact" || h.level === "full") return true;
      if (h.movementTrack) return true;
      if (h.oneWallShooterUntilMove) return true;
    } else if (difficulty === "expert") {
      if (locRank(h.level) >= 1) return true;
    } else if (difficulty === "trained") {
      if (h.movementTrack && locRank(h.level) >= 1) return true;
      if (h.oneWallShooterUntilMove) return true;
      if (h.knownCombatLocation && locRank(h.level) >= 1) return true;
    }
    // novice / newstupid: no A-range / combatant / one-wall interrupt (Q5 weaker).
  }
  return false;
}

function defaultGait(difficulty: NpcDifficultyId, rng: () => number): MovementGait {
  if (difficulty === "professional" || difficulty === "newstupid") return "walk";
  if (difficulty === "novice") return "run";
  if (difficulty === "expert") return rng() >= 0.2 ? "walk" : "run";
  return rng() < 0.3 ? "walk" : "run";
}

function assistGait(difficulty: NpcDifficultyId, rng: () => number, safeLos?: boolean): MovementGait {
  if (difficulty === "newstupid" || difficulty === "novice") return "run";
  if (safeLos === undefined) return defaultGait(difficulty, rng);
  return safeLos ? "run" : "walk";
}

export function pickNonCombatGait(
  difficulty: NpcDifficultyId,
  rng: () => number,
  opts?: { command?: SlaveCommand | null; safeLos?: boolean },
): MovementGait {
  if (opts?.command?.kind === "assist") return assistGait(difficulty, rng, opts.safeLos);
  return defaultGait(difficulty, rng);
}

function roomNeighbors(nav: EncounterNav, id: string): string[] {
  const out: string[] = [];
  for (const e of nav.graph.edges) {
    if (e.a === id) out.push(e.b);
    else if (e.b === id) out.push(e.a);
  }
  return out;
}

/** One shared BFS of unsearched rooms (Q29). Unreachable rooms append after the walk. */
export function bfsUnsearchedRoomIds(
  nav: EncounterNav,
  searched: ReadonlySet<string>,
  startRoomId?: string,
): string[] {
  const remaining = nav.rooms.map((r) => r.id).filter((id) => !searched.has(id));
  if (remaining.length === 0) return [];
  const remainingSet = new Set(remaining);
  const start =
    (startRoomId && nav.rooms.some((r) => r.id === startRoomId) ? startRoomId : undefined) ??
    remaining[0]!;

  const order: string[] = [];
  const seen = new Set<string>([start]);
  const q = [start];
  while (q.length > 0) {
    const cur = q.shift()!;
    if (remainingSet.has(cur)) order.push(cur);
    for (const n of roomNeighbors(nav, cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  for (const id of remaining) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

export function splitSearchRooms(
  slaveIds: readonly string[],
  bfsOrder: readonly string[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of slaveIds) out.set(id, []);
  if (slaveIds.length === 0) return out;
  bfsOrder.forEach((roomId, i) => {
    out.get(slaveIds[i % slaveIds.length]!)!.push(roomId);
  });
  return out;
}

function nearestRoomId(nav: EncounterNav, pos: Vec2): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const r of nav.rooms) {
    const d = Math.hypot(pos.x - r.centroid.x, pos.y - r.centroid.y);
    if (d < bestD) {
      bestD = d;
      best = r.id;
    }
  }
  return best;
}

function roomCentroid(nav: EncounterNav, id: string): Vec2 | undefined {
  return nav.rooms.find((r) => r.id === id)?.centroid;
}

function investigatePoint(input: TickNonCombatInput, hostiles: readonly HostileView[]): Vec2 | undefined {
  if (input.lastKnownPosition) return input.lastKnownPosition;
  for (const h of hostiles) {
    if (h.lastKnownPosition) return h.lastKnownPosition;
  }
  return undefined;
}

function someoneAt(pos: Vec2, hostiles: readonly HostileView[]): boolean {
  return hostiles.some((h) => {
    if (h.truePos && atPoint(h.truePos, pos)) return true;
    if (h.present === false) return false;
    if (h.lastKnownPosition && atPoint(h.lastKnownPosition, pos) && locRank(h.level) >= 1) return true;
    return false;
  });
}

function searchingSlaveIds(squad: readonly LeaderCandidate[], leaderId: string | null): string[] {
  const ids: string[] = [];
  for (const u of squad) {
    if (leaderId && u.id === leaderId) continue;
    if (u.command?.kind === "search") ids.push(u.id);
  }
  ids.sort();
  return ids;
}

function commandState(command: SlaveCommand | null, fallback: NonCombatState): NonCombatState {
  if (!command) return fallback;
  return command.kind;
}

function nextSlot(
  isSlave: boolean,
  current: SlaveCommand | null,
  issued: SlaveCommand | null | undefined,
): SlaveCommand | null {
  if (!isSlave) return null;
  if (issued !== undefined && issued !== null) return issued;
  return current;
}

function maybeDisobey(
  isSlave: boolean,
  command: SlaveCommand | null,
  difficulty: NpcDifficultyId,
  rng: () => number,
): boolean {
  if (!isSlave || !command) return false;
  return rng() < disobeyChance(difficulty);
}

function patrolTick(
  input: TickNonCombatInput,
  rng: () => number,
): { destination?: Vec2; patrolIndex: number; rebuildNav: boolean; huntRoute?: HuntPatrolRoute; nav?: EncounterNav } {
  const route = input.huntRoute;
  const waypoints = route?.waypoints ?? [];
  let index = input.patrolIndex ?? 0;
  if (waypoints.length === 0) {
    return { patrolIndex: 0, rebuildNav: false };
  }
  if (index < 0) index = 0;
  if (index >= waypoints.length) index = 0;

  while (index < waypoints.length && roomWaypointCleared(input, waypoints[index]!)) {
    index += 1;
  }
  if (index < waypoints.length) {
    return {
      destination: waypoints[index]!.position,
      patrolIndex: index,
      rebuildNav: false,
    };
  }

  const rebuildNav = shouldRebuildRooms("patrol-end");
  if (rebuildNav && input.map) {
    const nav = buildEncounterNav(input.map);
    const huntRoute = buildHuntPatrolRoute({
      nav,
      origin: input.position,
      difficulty: input.difficulty,
      rng,
    });
    const nextInput = { ...input, huntRoute, nav };
    let nextIndex = 0;
    while (
      nextIndex < huntRoute.waypoints.length &&
      roomWaypointCleared(nextInput, huntRoute.waypoints[nextIndex]!)
    ) {
      nextIndex += 1;
    }
    if (nextIndex >= huntRoute.waypoints.length) {
      return { patrolIndex: 0, rebuildNav, huntRoute, nav };
    }
    return {
      destination: huntRoute.waypoints[nextIndex]!.position,
      patrolIndex: nextIndex,
      rebuildNav,
      huntRoute,
      nav,
    };
  }
  return { patrolIndex: 0, rebuildNav };
}

export function tickNonCombat(input: TickNonCombatInput): TickNonCombatResult {
  const rng = input.rng ?? mulberry32(1);
  const leaderId = pickSquadLeader(input.squad, input.leaderIdOverride);
  const isSlave = leaderId !== null && input.unitId !== leaderId && input.squad.length > 1;
  const hostiles = resolveHostiles(input);
  const inCombat = hasHostileExactOrFull(hostiles);
  const gaitFor = (command: SlaveCommand | null) =>
    pickNonCombatGait(input.difficulty, rng, { command, safeLos: input.safeLos });

  const base = (
    partial: Omit<TickNonCombatResult, "gait" | "isSlave" | "leaderId" | "inCombat"> & { gait?: MovementGait },
  ): TickNonCombatResult => ({
    ...partial,
    gait: partial.gait ?? gaitFor(partial.command),
    isSlave,
    leaderId,
    inCombat,
  });

  let command = nextSlot(isSlave, input.command ?? null, input.issuedCommand);
  if (input.disobeyedLastTurn && !input.newCommandThisTurn && input.issuedCommand == null) {
    command = null;
  }

  const disobeyed = maybeDisobey(isSlave, command, input.difficulty, rng);
  if (disobeyed) command = null;

  const searched = new Set(input.searchedRooms ?? []);
  if (input.nav) {
    const here = nearestRoomId(input.nav, input.position);
    if (here && atPoint(input.position, roomCentroid(input.nav, here)!)) searched.add(here);
  }
  const searchedRooms = [...searched];

  if (inCombat) {
    return base({
      state: commandState(command, input.state ?? "patrol"),
      command,
      destination: commandDestination(command, input, searchedRooms, leaderId),
      rebuildNav: false,
      freeFire: command?.kind === "search",
      disobeyed,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  if (disobeyed) {
    const patrol = patrolTick(input, rng);
    return base({
      state: "patrol",
      command: null,
      destination: patrol.destination,
      rebuildNav: patrol.rebuildNav,
      freeFire: false,
      disobeyed: true,
      patrolIndex: patrol.patrolIndex,
      searchedRooms,
      huntRoute: patrol.huntRoute,
      nav: patrol.nav,
    });
  }

  if (command?.kind === "search") {
    const nav = input.nav;
    const allIds = nav?.rooms.map((r) => r.id) ?? [];
    const complete = allIds.length > 0 && allIds.every((id) => searched.has(id));
    if (complete) {
      const patrol = patrolTick({ ...input, command: null }, rng);
      return base({
        state: "patrol",
        command: null,
        destination: patrol.destination,
        rebuildNav: patrol.rebuildNav,
        freeFire: false,
        disobeyed: false,
        patrolIndex: patrol.patrolIndex,
        searchedRooms,
        huntRoute: patrol.huntRoute,
        nav: patrol.nav,
        gait: gaitFor(null),
      });
    }
    return base({
      state: "search",
      command,
      destination: commandDestination(command, input, searchedRooms, leaderId),
      rebuildNav: false,
      freeFire: true,
      disobeyed: false,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  if (command?.kind === "recon") {
    if (atPoint(input.position, command.point)) {
      const patrol = patrolTick({ ...input, command: null }, rng);
      return base({
        state: "patrol",
        command: null,
        destination: patrol.destination,
        rebuildNav: patrol.rebuildNav,
        freeFire: false,
        disobeyed: false,
        patrolIndex: patrol.patrolIndex,
        searchedRooms,
        huntRoute: patrol.huntRoute,
        nav: patrol.nav,
        gait: gaitFor(null),
      });
    }
    return base({
      state: "recon",
      command,
      destination: command.point,
      rebuildNav: false,
      freeFire: false,
      disobeyed: false,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  if (command?.kind === "assist") {
    const dest = input.leaderPosition ?? input.squad.find((u) => u.id === leaderId)?.position;
    return base({
      state: "assist",
      command,
      destination: dest,
      rebuildNav: false,
      freeFire: false,
      disobeyed: false,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  const lkp = investigatePoint(input, hostiles);
  const approxLeft = hostiles.some((h) => h.level === "approximate");
  const wantInvestigate =
    (input.state === "investigate" && lkp !== undefined) ||
    (lkp !== undefined &&
      canInvestigateApproximate(input.difficulty) &&
      (approxLeft || patrolDetectionInterrupt(input.difficulty, hostiles)));

  if (wantInvestigate && lkp) {
    if (atPoint(input.position, lkp) && !someoneAt(lkp, hostiles) && !input.hasNewIntel) {
      const patrol = patrolTick(input, rng);
      return base({
        state: "patrol",
        command: null,
        destination: patrol.destination,
        rebuildNav: patrol.rebuildNav,
        freeFire: false,
        disobeyed: false,
        patrolIndex: patrol.patrolIndex,
        searchedRooms,
        huntRoute: patrol.huntRoute,
        nav: patrol.nav,
      });
    }
    return base({
      state: "investigate",
      command: null,
      destination: lkp,
      rebuildNav: false,
      freeFire: false,
      disobeyed: false,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  if (input.state === "patrol" && patrolDetectionInterrupt(input.difficulty, hostiles) && lkp) {
    return base({
      state: "investigate",
      command: null,
      destination: lkp,
      rebuildNav: false,
      freeFire: false,
      disobeyed: false,
      patrolIndex: input.patrolIndex ?? 0,
      searchedRooms,
    });
  }

  const patrol = patrolTick(input, rng);
  return base({
    state: "patrol",
    command: null,
    destination: patrol.destination,
    rebuildNav: patrol.rebuildNav,
    freeFire: false,
    disobeyed: false,
    patrolIndex: patrol.patrolIndex,
    searchedRooms,
    huntRoute: patrol.huntRoute,
    nav: patrol.nav,
  });
}

function commandDestination(
  command: SlaveCommand | null,
  input: TickNonCombatInput,
  searchedRooms: readonly string[],
  leaderId: string | null,
): Vec2 | undefined {
  if (!command) return undefined;
  if (command.kind === "recon") return command.point;
  if (command.kind === "assist") {
    return input.leaderPosition ?? input.squad.find((u) => u.id === leaderId)?.position;
  }
  if (command.kind === "search" && input.nav) {
    const searched = new Set(searchedRooms);
    const order = bfsUnsearchedRoomIds(input.nav, searched, input.nav.rooms[0]?.id);
    const slaves = searchingSlaveIds(
      input.squad.map((u) => (u.id === input.unitId ? { ...u, command } : u)),
      leaderId,
    );
    const ids = slaves.length > 0 ? slaves : [input.unitId];
    const split = splitSearchRooms(ids, order);
    const mine = split.get(input.unitId) ?? order;
    const nextId = mine.find((id) => !searched.has(id)) ?? order.find((id) => !searched.has(id));
    return nextId ? roomCentroid(input.nav, nextId) : undefined;
  }
  return undefined;
}
