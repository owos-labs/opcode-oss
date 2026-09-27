import type { CoverHeightBand } from "./cover-concealment-view.ts";
import { rayCoverHitT } from "./cover.ts";
import { hasLineOfSight, type Vec2, type WallSegment } from "./visibility.ts";

export type { Vec2, WallSegment };

export type TacticalStance = {
  id: number;
  position: Vec2;
  /** Cost from the NPC origin to this stance (meters). */
  cost: number;
};

export type BallisticBarrier = WallSegment & {
  id: string;
  armorRating: number;
  maxSsp: number;
  currentSsp: number;
  /** When true, blocks optical LOS like a hard wall. */
  blocksVision: boolean;
  /** From SVG cover-height (map.impl.py); affects hit difficulty when target uses this cover. */
  coverHeightBand?: CoverHeightBand;
};

export type OrderedBarrierHit = {
  barrierId: string;
  t: number;
  armorRating: number;
  currentSsp: number;
};

const EPS = 1e-6;

/** Ray hits along observer→target, sorted by parametric t (near to far). */
export function orderedBarrierHits(
  observer: Vec2,
  target: Vec2,
  barriers: readonly BallisticBarrier[],
): OrderedBarrierHit[] {
  const hits: OrderedBarrierHit[] = [];
  for (const barrier of barriers) {
    const t = rayCoverHitT(observer, target, barrier);
    if (t === null) continue;
    hits.push({
      barrierId: barrier.id,
      t,
      armorRating: barrier.armorRating,
      currentSsp: barrier.currentSsp,
    });
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

export function visionBlockingSegments(
  barriers: readonly BallisticBarrier[],
): WallSegment[] {
  return barriers.filter(b => b.blocksVision);
}

/** Straight segment from origin to point must be clear of walls. */
export function isStraightWalkClear(
  origin: Vec2,
  point: Vec2,
  walls: readonly WallSegment[],
): boolean {
  return hasLineOfSight(origin, point, walls);
}

export type LocalStanceGridInput = {
  origin: Vec2;
  /** Max movement budget from origin (meters). */
  movBudget: number;
  cellSize: number;
  walls: readonly WallSegment[];
  maxStances: number;
};

/**
 * Sparse local grid candidates inside movBudget, capped at maxStances.
 * Index 0 in downstream tensors should map to origin (hold); this returns extras only.
 */
export function localTacticalStances(input: LocalStanceGridInput): TacticalStance[] {
  const { origin, movBudget, cellSize, maxStances } = input;
  if (movBudget <= EPS || maxStances <= 0) return [];

  const steps = Math.max(1, Math.ceil(movBudget / Math.max(cellSize, EPS)));
  const seen = new Set<string>();
  const out: TacticalStance[] = [];

  const key = (x: number, y: number) => `${x.toFixed(4)},${y.toFixed(4)}`;

  for (let ix = -steps; ix <= steps; ix++) {
    for (let iy = -steps; iy <= steps; iy++) {
      const position = {
        x: origin.x + ix * cellSize,
        y: origin.y + iy * cellSize,
      };
      const cost = Math.hypot(position.x - origin.x, position.y - origin.y);
      if (cost > movBudget + EPS) continue;
      const k = key(position.x, position.y);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ id: out.length + 1, position, cost });
      if (out.length >= maxStances) return out;
    }
  }
  return out;
}
