import { isStraightWalkClear, visionBlockingSegments } from "../combat-ai/geometry.ts";
import type { CoverHeightBand } from "../combat-ai/cover-concealment-view.ts";
import type { Vec2, WallSegment } from "../combat-ai/visibility.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import type { MapSolveBounds } from "./map-adapter/compile-svg-map.ts";

const EPS = 1e-6;
const END_MARGIN = 0.02;

export type CombatRoom = {
  id: string;
  centroid: Vec2;
  /** Cell centers. Overlap-band cells appear on every room that owns the band. */
  cells: Vec2[];
};

export type DetectRoomsOptions = {
  cellSize?: number;
  /** Max distance from a cell to a wall for the ≥3-wall pocket test. */
  pocketRadius?: number;
  /** Walkable flood from each pocket core; meeting cells become dual-membership. */
  floodRange?: number;
  /** Invent rooms from ≥3 walls. Default off: only SVG yellow/type=room. */
  pockets?: boolean;
};

function hypot2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS * EPS) {
    return { dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const tc = Math.max(0, Math.min(1, t));
  return {
    dist: Math.hypot(p.x - (a.x + tc * dx), p.y - (a.y + tc * dy)),
    t: tc,
  };
}

/** True when P sits beside the segment interior (not past an endpoint) within radius. */
function wallNearby(p: Vec2, wall: WallSegment, radius: number, onWall: number): boolean {
  const { dist, t } = projectOnSegment(p, wall.a, wall.b);
  if (t <= END_MARGIN || t >= 1 - END_MARGIN) return false;
  return dist > onWall && dist <= radius + EPS;
}

function countNearbyWalls(p: Vec2, walls: readonly WallSegment[], radius: number, onWall: number): number {
  let n = 0;
  for (const wall of walls) {
    if (wallNearby(p, wall, radius, onWall)) n += 1;
  }
  return n;
}

/** How many of N/E/S/W are blocked by a wall within radius (semi-enclosed pocket). */
function cardinalEnclosure(p: Vec2, walls: readonly WallSegment[], radius: number): number {
  const rays: Vec2[] = [
    { x: p.x - radius, y: p.y },
    { x: p.x + radius, y: p.y },
    { x: p.x, y: p.y - radius },
    { x: p.x, y: p.y + radius },
  ];
  let n = 0;
  for (const to of rays) {
    if (!isStraightWalkClear(p, to, walls)) n += 1;
  }
  return n;
}

function isPocketCell(p: Vec2, walls: readonly WallSegment[], radius: number, onWall: number): boolean {
  return cardinalEnclosure(p, walls, radius) >= 3 || countNearbyWalls(p, walls, radius, onWall) >= 3;
}

function distToAnyWall(p: Vec2, walls: readonly WallSegment[]): number {
  let best = Infinity;
  for (const wall of walls) {
    const { dist } = projectOnSegment(p, wall.a, wall.b);
    if (dist < best) best = dist;
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function visionWalls(map: CompiledCombatMap): WallSegment[] {
  if (map.walls.length > 0) return [...map.walls];
  return visionBlockingSegments(map.barriers);
}

/** SVG cover-height: full (and untyped DTO walls) enclose rooms; half/leg/2/3 are cover. */
export function isStructuralCoverBand(band: CoverHeightBand | undefined): boolean {
  return band === undefined || band === "none" || band === "full";
}

/** Walls that can enclose a room. bounding_box / concealment never appear here. */
export function enclosureWalls(map: CompiledCombatMap): WallSegment[] {
  if (map.barriers.length === 0) return visionWalls(map);
  return map.barriers
    .filter((b) => b.blocksVision && isStructuralCoverBand(b.coverHeightBand))
    .map((b) => ({ a: b.a, b: b.b }));
}

export function navBounds(map: CompiledCombatMap, walls = visionWalls(map)): MapSolveBounds {
  if (map.solveBounds) return map.solveBounds;
  if (walls.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  const pad = 1;
  return { min: { x: minX - pad, y: minY - pad }, max: { x: maxX + pad, y: maxY + pad } };
}

function pointInBounds(p: Vec2, bounds: MapSolveBounds): boolean {
  return (
    p.x >= bounds.min.x - EPS &&
    p.x <= bounds.max.x + EPS &&
    p.y >= bounds.min.y - EPS &&
    p.y <= bounds.max.y + EPS
  );
}

function derivePocketRadius(walls: readonly WallSegment[], bounds: MapSolveBounds, cellSize: number): number {
  const lengths = walls.map((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)).filter((l) => l > cellSize * 0.25);
  const med = median(lengths);
  const span = Math.min(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  const fromWalls = med > EPS ? 0.65 * med : 5;
  return Math.max(cellSize * 3, Math.min(fromWalls, span * 0.7 + cellSize));
}

export function combatRoomsFromRings(
  rings: readonly { id: string; ring: readonly Vec2[] }[],
  cellSize = 1,
): CombatRoom[] {
  const rooms: CombatRoom[] = [];
  for (const [i, entry] of rings.entries()) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of entry.ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) continue;
    const cells: Vec2[] = [];
    const ix0 = Math.floor(minX / cellSize);
    const iy0 = Math.floor(minY / cellSize);
    const ix1 = Math.ceil(maxX / cellSize);
    const iy1 = Math.ceil(maxY / cellSize);
    for (let ix = ix0; ix < ix1; ix++) {
      for (let iy = iy0; iy < iy1; iy++) {
        const p = { x: (ix + 0.5) * cellSize, y: (iy + 0.5) * cellSize };
        if (p.x >= minX - EPS && p.x <= maxX + EPS && p.y >= minY - EPS && p.y <= maxY + EPS) {
          cells.push(p);
        }
      }
    }
    rooms.push({
      id: entry.id || `room-${i}`,
      centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      cells: cells.length > 0 ? cells : [{ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }],
    });
  }
  rooms.sort((a, b) => a.centroid.x - b.centroid.x || a.centroid.y - b.centroid.y);
  return rooms;
}

/**
 * Semi-enclosed walkable pockets (≥3 walls). Only used when `opts.pockets` is set.
 */
export function detectPocketRooms(map: CompiledCombatMap, opts: DetectRoomsOptions = {}): CombatRoom[] {
  const obstacles = visionWalls(map);
  const walls = enclosureWalls(map);
  if (walls.length < 3) return [];

  const bounds = navBounds(map, obstacles);
  const cellSize = opts.cellSize ?? 1;
  const onWall = cellSize * 0.2;
  const pocketRadius = opts.pocketRadius ?? derivePocketRadius(walls, bounds, cellSize);
  const floodRange = opts.floodRange ?? Math.max(cellSize * 3, pocketRadius * 0.6);

  const ix0 = Math.floor(bounds.min.x / cellSize);
  const iy0 = Math.floor(bounds.min.y / cellSize);
  const ix1 = Math.ceil(bounds.max.x / cellSize);
  const iy1 = Math.ceil(bounds.max.y / cellSize);

  const cellPos = (ix: number, iy: number): Vec2 => ({
    x: (ix + 0.5) * cellSize,
    y: (iy + 0.5) * cellSize,
  });

  const seedKeys: string[] = [];
  const seedSet = new Set<string>();
  for (let ix = ix0; ix < ix1; ix++) {
    for (let iy = iy0; iy < iy1; iy++) {
      const p = cellPos(ix, iy);
      if (!pointInBounds(p, bounds)) continue;
      if (distToAnyWall(p, obstacles) <= onWall) continue;
      if (!isPocketCell(p, walls, pocketRadius, onWall)) continue;
      const k = `${ix},${iy}`;
      seedKeys.push(k);
      seedSet.add(k);
    }
  }
  if (seedKeys.length === 0) return [];

  const parseKey = (k: string): { ix: number; iy: number } => {
    const [xs, ys] = k.split(",");
    return { ix: Number(xs), iy: Number(ys) };
  };

  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const visited = new Set<string>();
  const cores: string[][] = [];
  for (const start of seedKeys) {
    if (visited.has(start)) continue;
    const stack = [start];
    visited.add(start);
    const group: string[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      group.push(cur);
      const { ix, iy } = parseKey(cur);
      for (const [dx, dy] of dirs) {
        const nk = `${ix + dx},${iy + dy}`;
        if (!seedSet.has(nk) || visited.has(nk)) continue;
        visited.add(nk);
        stack.push(nk);
      }
    }
    if (group.length > 0) cores.push(group);
  }

  type Reach = { room: number; dist: number };
  const reach = new Map<string, Reach[]>();
  const maxSteps = Math.max(1, Math.ceil(floodRange / cellSize));

  for (let ri = 0; ri < cores.length; ri++) {
    const q: Array<{ k: string; d: number }> = [];
    const seen = new Set<string>();
    for (const k of cores[ri]!) {
      q.push({ k, d: 0 });
      seen.add(k);
    }
    let qi = 0;
    while (qi < q.length) {
      const { k, d } = q[qi++]!;
      const list = reach.get(k) ?? [];
      list.push({ room: ri, dist: d });
      reach.set(k, list);
      if (d >= maxSteps) continue;
      const { ix, iy } = parseKey(k);
      const from = cellPos(ix, iy);
      for (const [dx, dy] of dirs) {
        const nix = ix + dx;
        const niy = iy + dy;
        const nk = `${nix},${niy}`;
        if (seen.has(nk)) continue;
        const to = cellPos(nix, niy);
        if (!pointInBounds(to, bounds)) continue;
        if (distToAnyWall(to, obstacles) <= onWall) continue;
        if (!isStraightWalkClear(from, to, obstacles)) continue;
        seen.add(nk);
        q.push({ k: nk, d: d + 1 });
      }
    }
  }

  const cellsByRoom: Vec2[][] = cores.map(() => []);
  for (const [k, owners] of reach) {
    const { ix, iy } = parseKey(k);
    const p = cellPos(ix, iy);
    const unique = new Set(owners.map((o) => o.room));
    for (const ri of unique) cellsByRoom[ri]!.push(p);
  }

  const rooms: CombatRoom[] = [];
  for (let ri = 0; ri < cores.length; ri++) {
    const cells = cellsByRoom[ri]!;
    if (cells.length === 0) continue;
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      sx += c.x;
      sy += c.y;
    }
    rooms.push({
      id: "",
      centroid: { x: sx / cells.length, y: sy / cells.length },
      cells,
    });
  }

  rooms.sort((a, b) => a.centroid.x - b.centroid.x || a.centroid.y - b.centroid.y);
  for (let i = 0; i < rooms.length; i++) rooms[i]!.id = `room-${i}`;
  return rooms;
}

/** Authored SVG rooms only. No yellow / type=room → no rooms unless `pockets`. */
export function detectRooms(map: CompiledCombatMap, opts: DetectRoomsOptions = {}): CombatRoom[] {
  if (map.authoredRooms && map.authoredRooms.length > 0) return map.authoredRooms;
  if (opts.pockets) return detectPocketRooms(map, opts);
  return [];
}

export function roomsShareCell(a: CombatRoom, b: CombatRoom, eps = 1e-6): Vec2[] {
  const shared: Vec2[] = [];
  for (const ac of a.cells) {
    if (b.cells.some((bc) => hypot2(ac, bc) <= eps * eps)) shared.push(ac);
  }
  return shared;
}
