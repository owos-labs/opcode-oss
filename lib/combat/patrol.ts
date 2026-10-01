import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { isStraightWalkClear } from "../combat-ai/geometry.ts";
import { mulberry32 } from "../combat-ai/planning.ts";
import { hasLineOfSight, type Vec2, type WallSegment } from "../combat-ai/visibility.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import type { MapSolveBounds } from "./map-adapter/compile-svg-map.ts";
import { detectRooms, navBounds, visionWalls, type CombatRoom, type DetectRoomsOptions } from "./rooms.ts";

export type { CombatRoom, DetectRoomsOptions };

/** Rebuild rooms only at encounter start and when a patrol finishes (Q19). */
export type RoomRebuildReason = "encounter-start" | "patrol-end" | "shot-through-cover";

export type PatrolNode = {
  id: string;
  kind: "room" | "corner";
  position: Vec2;
  roomId?: string;
};

/** Unweighted undirected adjacency. No pathfinding costs. */
export type PatrolEdge = {
  a: string;
  b: string;
};

export type PatrolGraph = {
  nodes: PatrolNode[];
  edges: PatrolEdge[];
};

export type EncounterNav = {
  rooms: CombatRoom[];
  graph: PatrolGraph;
  bounds: MapSolveBounds;
};

export type HuntWaypoint = {
  position: Vec2;
  roomId?: string;
  role: "room" | "corner" | "opposite" | "random";
};

export type HuntPatrolRoute = {
  difficulty: NpcDifficultyId;
  waypoints: HuntWaypoint[];
};

export type HuntRouteRng = () => number;

export function shouldRebuildRooms(reason: RoomRebuildReason): boolean {
  return reason === "encounter-start" || reason === "patrol-end";
}

/** Hunt success: wiping remaining hostiles completes the mission. */
export function huntWipeComplete(remainingHostiles: number): boolean {
  return remainingHostiles <= 0;
}

/** Patrol only needs LOS into the room, not to stand on the centroid. */
export function canSeeRoomInterior(
  from: Vec2,
  room: CombatRoom,
  walls: readonly WallSegment[],
): boolean {
  if (hasLineOfSight(from, room.centroid, walls)) return true;
  const cells = room.cells;
  if (cells.length === 0) return false;
  const step = Math.max(1, Math.floor(cells.length / 8));
  for (let i = 0; i < cells.length; i += step) {
    if (hasLineOfSight(from, cells[i]!, walls)) return true;
  }
  return false;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampToBounds(p: Vec2, bounds: MapSolveBounds): Vec2 {
  return {
    x: Math.min(bounds.max.x, Math.max(bounds.min.x, p.x)),
    y: Math.min(bounds.max.y, Math.max(bounds.min.y, p.y)),
  };
}

function oppositePoint(origin: Vec2, bounds: MapSolveBounds): Vec2 {
  const reflected = clampToBounds(
    {
      x: bounds.min.x + bounds.max.x - origin.x,
      y: bounds.min.y + bounds.max.y - origin.y,
    },
    bounds,
  );
  if (dist(reflected, origin) > 1e-3) return reflected;
  return farthestCorner(origin, mapCorners(bounds));
}

function mapCorners(bounds: MapSolveBounds): Vec2[] {
  return [
    { x: bounds.min.x, y: bounds.min.y },
    { x: bounds.max.x, y: bounds.min.y },
    { x: bounds.min.x, y: bounds.max.y },
    { x: bounds.max.x, y: bounds.max.y },
  ];
}

function farthestCorner(from: Vec2, corners: Vec2[]): Vec2 {
  let best = corners[0]!;
  let bestD = -1;
  for (const c of corners) {
    const d = dist(from, c);
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function nearestPoint(from: Vec2, points: Vec2[]): Vec2 {
  let best = points[0]!;
  let bestD = Infinity;
  for (const p of points) {
    const d = dist(from, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function projectT(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const t = Math.max(0, Math.min(1, projectT(p, a, b)));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function roomsAlongSegment(
  from: Vec2,
  to: Vec2,
  rooms: readonly CombatRoom[],
  threshold: number,
): CombatRoom[] {
  const hits = rooms.filter((r) => {
    const t = projectT(r.centroid, from, to);
    if (t <= 0.05 || t >= 0.95) return false;
    return distToSegment(r.centroid, from, to) <= threshold + 1e-6;
  });
  hits.sort((a, b) => projectT(a.centroid, from, to) - projectT(b.centroid, from, to));
  return hits;
}

function alongThreshold(rooms: readonly CombatRoom[], bounds: MapSolveBounds): number {
  const span = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  if (rooms.length === 0) return Math.max(4, span * 0.2);
  let acc = 0;
  for (const r of rooms) {
    let rad = 0;
    for (const c of r.cells) rad = Math.max(rad, dist(r.centroid, c));
    acc += Math.max(rad, 2);
  }
  return acc / rooms.length;
}

function pickRandomPoint(bounds: MapSolveBounds, walls: readonly WallSegment[], rng: HuntRouteRng): Vec2 {
  for (let i = 0; i < 12; i++) {
    const p = {
      x: bounds.min.x + rng() * (bounds.max.x - bounds.min.x),
      y: bounds.min.y + rng() * (bounds.max.y - bounds.min.y),
    };
    if (walls.every((w) => distToSegment(p, w.a, w.b) > 0.3)) return p;
  }
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
  };
}

function nodeIdPair(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildPatrolGraph(
  map: CompiledCombatMap,
  rooms: readonly CombatRoom[],
  bounds: MapSolveBounds,
): PatrolGraph {
  const walls = visionWalls(map);
  const nodes: PatrolNode[] = rooms.map((r) => ({
    id: r.id,
    kind: "room" as const,
    position: r.centroid,
    roomId: r.id,
  }));
  const cornerPts = mapCorners(bounds);
  const cornerIds = ["corner-sw", "corner-se", "corner-nw", "corner-ne"] as const;
  for (let i = 0; i < cornerPts.length; i++) {
    nodes.push({ id: cornerIds[i]!, kind: "corner", position: cornerPts[i]! });
  }

  const overlapPairs = new Set<string>();
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i]!;
    const aKeys = new Set(a.cells.map((c) => `${c.x.toFixed(4)},${c.y.toFixed(4)}`));
    for (let j = i + 1; j < rooms.length; j++) {
      const b = rooms[j]!;
      if (b.cells.some((c) => aKeys.has(`${c.x.toFixed(4)},${c.y.toFixed(4)}`))) {
        overlapPairs.add(nodeIdPair(a.id, b.id));
      }
    }
  }

  const edgeSet = new Set<string>();
  const edges: PatrolEdge[] = [];
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const k = nodeIdPair(a, b);
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push({ a, b });
  };

  for (const pair of overlapPairs) {
    const [a, b] = pair.split("|") as [string, string];
    addEdge(a, b);
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const na = nodes[i]!;
      const nb = nodes[j]!;
      if (isStraightWalkClear(na.position, nb.position, walls)) addEdge(na.id, nb.id);
    }
  }
  return { nodes, edges };
}

/** Encounter-start (and patrol-end) builder: rooms + unweighted patrol graph. */
export function buildEncounterNav(map: CompiledCombatMap, opts?: DetectRoomsOptions): EncounterNav {
  const rooms = detectRooms(map, opts);
  const bounds = navBounds(map);
  const graph = buildPatrolGraph(map, rooms, bounds);
  return { rooms, graph, bounds };
}

function pushAlong(
  waypoints: HuntWaypoint[],
  from: Vec2,
  to: Vec2,
  rooms: readonly CombatRoom[],
  threshold: number,
  include: (room: CombatRoom) => boolean,
): void {
  for (const room of roomsAlongSegment(from, to, rooms, threshold)) {
    if (!include(room)) continue;
    waypoints.push({ position: room.centroid, roomId: room.id, role: "room" });
  }
}

export function buildHuntPatrolRoute(input: {
  nav: EncounterNav;
  origin: Vec2;
  difficulty: NpcDifficultyId;
  rng?: HuntRouteRng;
  walls?: readonly WallSegment[];
}): HuntPatrolRoute {
  const rng = input.rng ?? mulberry32(1);
  const { rooms, bounds } = input.nav;
  const threshold = alongThreshold(rooms, bounds);
  const waypoints: HuntWaypoint[] = [];
  const coin = () => rng() < 0.5;

  if (input.difficulty === "professional") {
    const remaining = [...rooms];
    let cur = input.origin;
    while (remaining.length > 0) {
      remaining.sort((a, b) => dist(cur, a.centroid) - dist(cur, b.centroid));
      const next = remaining.shift()!;
      waypoints.push({ position: next.centroid, roomId: next.id, role: "room" });
      cur = next.centroid;
    }
    return { difficulty: input.difficulty, waypoints };
  }

  if (input.difficulty === "expert") {
    const corners = mapCorners(bounds);
    const first = nearestPoint(input.origin, corners);
    const rest = corners.filter((c) => dist(c, first) > 1e-6);
    const second = rest.length > 0 ? nearestPoint(first, rest) : first;
    pushAlong(waypoints, input.origin, first, rooms, threshold, coin);
    waypoints.push({ position: first, role: "corner" });
    pushAlong(waypoints, first, second, rooms, threshold, coin);
    waypoints.push({ position: second, role: "corner" });
    return { difficulty: input.difficulty, waypoints };
  }

  const walls = input.walls ?? [];
  const includeAlways = input.difficulty === "trained";
  const include = includeAlways ? () => true : coin;

  if (input.difficulty === "newstupid") {
    const opp = oppositePoint(input.origin, bounds);
    pushAlong(waypoints, input.origin, opp, rooms, threshold, include);
    waypoints.push({ position: opp, role: "opposite" });
    return { difficulty: input.difficulty, waypoints };
  }

  const opp = oppositePoint(input.origin, bounds);
  pushAlong(waypoints, input.origin, opp, rooms, threshold, include);
  waypoints.push({ position: opp, role: "opposite" });
  const random = pickRandomPoint(bounds, walls, rng);
  pushAlong(waypoints, opp, random, rooms, threshold, include);
  waypoints.push({ position: random, role: "random" });

  if (input.difficulty === "trained") {
    const opp2 = oppositePoint(random, bounds);
    pushAlong(waypoints, random, opp2, rooms, threshold, include);
    waypoints.push({ position: opp2, role: "opposite" });
  }

  return { difficulty: input.difficulty, waypoints };
}
