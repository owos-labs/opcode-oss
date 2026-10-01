import { expandWalkCosts, type WalkCostNode } from "./walk-path.ts";
import type { CoverHeightBand } from "./cover-concealment-view.ts";
import { hasLineOfSight, type Vec2, type WallSegment } from "./visibility.ts";

export type { Vec2, WallSegment };

const EPS = 1e-6;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/** Parametric t on observer→target where the ray hits the segment interior. */
export function rayCoverHitT(observer: Vec2, target: Vec2, cover: WallSegment): number | null {
  const d1 = sub(target, observer);
  const d2 = sub(cover.b, cover.a);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(sub(cover.a, observer), d2) / denom;
  const u = cross(sub(cover.a, observer), d1) / denom;
  if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) return t;
  return null;
}

export function closestPointOnSegment(p: Vec2, seg: WallSegment): Vec2 {
  const abx = seg.b.x - seg.a.x;
  const aby = seg.b.y - seg.a.y;
  const ab2 = abx * abx + aby * aby;
  const t =
    ab2 <= EPS
      ? 0
      : Math.max(0, Math.min(1, ((p.x - seg.a.x) * abx + (p.y - seg.a.y) * aby) / ab2));
  return { x: seg.a.x + t * abx, y: seg.a.y + t * aby };
}

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
  inBounds?: (p: Vec2) => boolean;
};

function pickSpreadStances(items: TacticalStance[], maxStances: number): TacticalStance[] {
  if (items.length <= maxStances) return items;
  if (maxStances <= 1) return items.slice(0, 1);
  const out: TacticalStance[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < maxStances; i++) {
    const idx = Math.round((i * (items.length - 1)) / (maxStances - 1));
    if (seen.has(idx)) continue;
    seen.add(idx);
    out.push(items[idx]!);
  }
  return out;
}

export function stancesFromWalkCosts(
  nodes: readonly WalkCostNode[],
  input: Pick<LocalStanceGridInput, "movBudget" | "maxStances" | "inBounds">,
): TacticalStance[] {
  if (input.movBudget <= EPS || input.maxStances <= 0) return [];
  const seen = new Set<string>();
  const out: TacticalStance[] = [];
  for (const node of nodes) {
    if (node.cost < EPS || node.cost > input.movBudget + EPS) continue;
    if (input.inBounds && !input.inBounds(node.pos)) continue;
    const k = `${node.pos.x.toFixed(4)},${node.pos.y.toFixed(4)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: 0, position: { x: node.pos.x, y: node.pos.y }, cost: node.cost });
  }
  out.sort((a, b) => a.cost - b.cost);
  return pickSpreadStances(out, input.maxStances).map((s, i) => ({ ...s, id: i + 1 }));
}

/**
 * Sparse local grid candidates inside movBudget, capped at maxStances.
 * Index 0 in downstream tensors should map to origin (hold); this returns extras only.
 */
export function localTacticalStances(input: LocalStanceGridInput): TacticalStance[] {
  return stancesFromWalkCosts(
    expandWalkCosts(input.origin, input.walls, input.movBudget, input.cellSize),
    input,
  );
}
