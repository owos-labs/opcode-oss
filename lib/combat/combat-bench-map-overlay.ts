import type { Vec2, WallSegment } from "../combat-ai/visibility.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
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

/** All destinations within remaining mov budget (euclidean disk, not LOS-clipped). */
export function movementReachDiskMeters(input: {
  origin: Vec2;
  mov: number;
  metersMovedThisRound: number;
  rayCount?: number;
}): Vec2[] {
  const budget = remainingMoveBudgetMeters(input.mov, input.metersMovedThisRound);
  if (budget <= EPS) return [];
  return visibilityPolygonMeters({
    origin: input.origin,
    walls: [],
    maxRangeM: budget,
    rayCount: input.rayCount ?? 64,
  });
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
    }),
  };
}

export function pointWithinMovBudget(
  origin: Vec2,
  target: Vec2,
  mov: number,
  metersMovedThisRound: number,
): boolean {
  const budget = remainingMoveBudgetMeters(mov, metersMovedThisRound);
  return Math.hypot(target.x - origin.x, target.y - origin.y) <= budget + EPS;
}
