import { walkPathMeters, walkReachFrontier } from "../combat-ai/walk-path.ts";
import { hasLineOfSight, type Vec2, type WallSegment } from "../combat-ai/visibility.ts";
import { combatMapWalkWalls, type CompiledCombatMap } from "./map-adapter/compile.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";

const EPS = 1e-9;

/** Bench map FOV when weapon range is unknown. */
export const DEFAULT_BENCH_VISION_RANGE_M = 45;

/** Smallest positive t where origin + dir·t hits segment ab, else null. */
export function raySegmentHitT(origin: Vec2, dir: Vec2, a: Vec2, b: Vec2): number | null {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const dx = dir.x;
  const dy = dir.y;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < EPS) return null;
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const t = (ax * sy - ay * sx) / denom;
  const u = (ax * dy - ay * dx) / denom;
  if (t < EPS || u < -EPS || u > 1 + EPS) return null;
  return t;
}

export function visibilityPolygonMeters(input: {
  origin: Vec2;
  walls: readonly WallSegment[];
  maxRangeM: number;
  rayCount?: number;
}): Vec2[] {
  const maxRange = Math.max(0, input.maxRangeM);
  if (maxRange <= EPS) return [input.origin];

  const rays = Math.max(8, input.rayCount ?? 72);
  const points: Vec2[] = [];

  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    let best = maxRange;
    for (const wall of input.walls) {
      const t = raySegmentHitT(input.origin, dir, wall.a, wall.b);
      if (t !== null && t < best) best = t;
    }
    points.push({
      x: input.origin.x + dir.x * best,
      y: input.origin.y + dir.y * best,
    });
  }
  return points;
}

function normalizeRad(angle: number): number {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

export function visibilityArcBounds(
  origin: Vec2,
  walls: readonly WallSegment[],
  maxRangeM: number,
  rayCount = 72,
): { startRad: number; endRad: number } {
  const maxRange = Math.max(0, maxRangeM);
  if (maxRange <= EPS) return { startRad: 0, endRad: Math.PI * 2 };

  const poly = visibilityPolygonMeters({ origin, walls, maxRangeM: maxRange, rayCount });
  const openThreshold = maxRange * 0.92;
  const openAngles = poly
    .filter((p) => Math.hypot(p.x - origin.x, p.y - origin.y) >= openThreshold - 1e-6)
    .map((p) => normalizeRad(Math.atan2(p.y - origin.y, p.x - origin.x)));

  if (openAngles.length === 0) return { startRad: 0, endRad: Math.PI * 2 };
  if (openAngles.length === 1) {
    const a = openAngles[0]!;
    return { startRad: a, endRad: a };
  }

  openAngles.sort((a, b) => a - b);
  let maxGap = 0;
  let gapAfter = 0;
  for (let i = 0; i < openAngles.length; i++) {
    const cur = openAngles[i]!;
    const next = openAngles[(i + 1) % openAngles.length]!;
    const gap = i === openAngles.length - 1 ? openAngles[0]! + Math.PI * 2 - cur : next - cur;
    if (gap > maxGap) {
      maxGap = gap;
      gapAfter = (i + 1) % openAngles.length;
    }
  }

  const visibleSpan = Math.PI * 2 - maxGap;
  if (visibleSpan >= Math.PI * 2 - 1e-2) return { startRad: 0, endRad: Math.PI * 2 };

  const startRad = openAngles[gapAfter]!;
  const endRad = normalizeRad(startRad + visibleSpan);
  return { startRad, endRad };
}

export function angleInVisibilityArc(
  angleRad: number,
  arc: { startRad: number; endRad: number },
): boolean {
  const a = normalizeRad(angleRad);
  const s = normalizeRad(arc.startRad);
  const e = normalizeRad(arc.endRad);
  if (e >= Math.PI * 2 - 1e-4 && s <= EPS) return true;
  if (Math.abs(s - e) < EPS) return true;
  if (s <= e) return a + EPS >= s && a <= e + EPS;
  return a + EPS >= s || a <= e + EPS;
}

/** Reachable cells by walked path (around walls), sorted as a ring for overlay. */
export function movementReachDiskMeters(input: {
  origin: Vec2;
  mov: number;
  metersMovedThisRound: number;
  walls?: readonly WallSegment[];
  cellSize?: number;
}): Vec2[] {
  const budget = remainingMoveBudgetMeters(input.mov, input.metersMovedThisRound);
  if (budget <= EPS) return [];
  const nodes = walkReachFrontier(input.origin, input.walls ?? [], budget, 36);
  if (nodes.length < 3) return nodes;
  const buckets = 72;
  const best: ({ pos: Vec2; r: number } | undefined)[] = new Array(buckets);
  for (const pos of nodes) {
    const dx = pos.x - input.origin.x;
    const dy = pos.y - input.origin.y;
    const r = Math.hypot(dx, dy);
    if (r < EPS) continue;
    let bucket = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * buckets);
    if (bucket < 0) bucket += buckets;
    if (bucket >= buckets) bucket = 0;
    const prev = best[bucket];
    if (!prev || r > prev.r) best[bucket] = { pos, r };
  }
  const pts = best.filter((b): b is { pos: Vec2; r: number } => b != null).map((b) => b.pos);
  if (pts.length < 3) return nodes.map((n) => n.pos);
  return pts.sort(
    (a, b) =>
      Math.atan2(a.y - input.origin.y, a.x - input.origin.x) -
      Math.atan2(b.y - input.origin.y, b.x - input.origin.x),
  );
}

export type CombatBenchMapOverlay = {
  origin: Vec2;
  visibility: Vec2[];
  /** Closed polygon approximating the mov-budget disk (meters). */
  movementDisk: Vec2[];
  movBudgetM: number;
  visionRangeM: number;
};

export function buildCombatBenchMapOverlay(input: {
  map: CompiledCombatMap;
  origin: Vec2;
  mov: number;
  metersMovedThisRound: number;
  visionRangeM: number;
}): CombatBenchMapOverlay {
  const visionRangeM = Math.max(1, input.visionRangeM);
  const movBudgetM = remainingMoveBudgetMeters(input.mov, input.metersMovedThisRound);
  return {
    origin: input.origin,
    visionRangeM: visionRangeM,
    movBudgetM,
    visibility: visibilityPolygonMeters({
      origin: input.origin,
      walls: input.map.walls,
      maxRangeM: visionRangeM,
    }),
    movementDisk: movementReachDiskMeters({
      origin: input.origin,
      mov: input.mov,
      metersMovedThisRound: input.metersMovedThisRound,
      walls: combatMapWalkWalls(input.map),
    }),
  };
}

export function pointWithinMovBudget(
  origin: Vec2,
  target: Vec2,
  mov: number,
  metersMovedThisRound: number,
  walls: readonly WallSegment[] = [],
): boolean {
  const budget = remainingMoveBudgetMeters(mov, metersMovedThisRound);
  const cost = walkPathMeters(origin, target, walls, { cellSize: 1, maxMeters: budget });
  return cost != null;
}

export type CombatBenchUnitVision = {
  placementId: string;
  team: string;
  polygon: Vec2[];
  alive: boolean;
};

/** Dead units stay on the map, drawn fainter than the living. */
export function combatRenderOpacity(alive: boolean): number {
  return alive ? 1 : 0.35;
}

export type CombatBenchVisionUnit = {
  placementId: string;
  team: string;
  origin: Vec2;
  visionRangeM: number;
  alive?: boolean;
};

export function buildCombatBenchUnitVisions(input: {
  map: CompiledCombatMap;
  units: readonly CombatBenchVisionUnit[];
}): CombatBenchUnitVision[] {
  return input.units.map((unit) => ({
    placementId: unit.placementId,
    team: unit.team,
    alive: unit.alive !== false,
    polygon: visibilityPolygonMeters({
      origin: unit.origin,
      walls: input.map.walls,
      maxRangeM: Math.max(1, unit.visionRangeM),
    }),
  }));
}

export type CombatBenchEffectLine = {
  fromId: string;
  toId: string;
  from: Vec2;
  to: Vec2;
};

/** Undirected LOS between living units on different teams, inside both vision ranges. */
export function buildCombatBenchEffectLines(input: {
  walls: readonly WallSegment[];
  units: readonly CombatBenchVisionUnit[];
}): CombatBenchEffectLine[] {
  const live = input.units.filter((unit) => unit.alive !== false);
  const lines: CombatBenchEffectLine[] = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j]!;
      if (a.team === b.team) continue;
      const dist = Math.hypot(b.origin.x - a.origin.x, b.origin.y - a.origin.y);
      if (dist > a.visionRangeM || dist > b.visionRangeM) continue;
      if (!hasLineOfSight(a.origin, b.origin, input.walls)) continue;
      lines.push({
        fromId: a.placementId,
        toId: b.placementId,
        from: a.origin,
        to: b.origin,
      });
    }
  }
  return lines;
}
