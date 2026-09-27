import type { NpcDifficultyProfile } from "./difficulty.ts";
import { segmentsIntersect, type Vec2, type WallSegment } from "./visibility.ts";

export type CoverSegment = WallSegment & {
  /** Same unit as ammo/weapon penetration on the character sheet. */
  thickness: number;
};

const EPS = 1e-6;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/** Parametric t on observer→target where the ray hits the cover segment interior. */
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

/** Sum cover thickness along the shot line (multiple pieces stack). */
export function totalCoverThicknessOnRay(
  observer: Vec2,
  target: Vec2,
  covers: readonly CoverSegment[],
): number {
  let total = 0;
  for (const cover of covers) {
    if (rayCoverHitT(observer, target, cover) !== null) total += Math.max(0, cover.thickness);
  }
  return total;
}

export type CoverEngagementInput = {
  profile: NpcDifficultyProfile;
  /** Shooter point (character actor position or eye offset applied upstream). */
  observer: Vec2;
  /** Target point — actors have no radius. */
  target: Vec2;
  /** Ammo/weapon penetration for this shot. */
  penetration: number;
  /** 定位： aimed shot that may fire through cover for damage. */
  hasLocatedShot: boolean;
  covers: readonly CoverSegment[];
  /** Hard walls still block LOS entirely. */
  walls?: readonly WallSegment[];
};

export type CoverEngagementResult =
  | { kind: "clear" }
  | { kind: "blocked"; reason: "wall" | "cover" }
  | { kind: "through_cover"; stackedThickness: number };

/**
 * Novice and below: any cover/wall on the line blocks damage.
 * Trained+: thickness vs penetration; located shot may damage through cover.
 */
export function resolveCoverEngagement(input: CoverEngagementInput): CoverEngagementResult {
  const walls = input.walls ?? [];
  for (const wall of walls) {
    if (segmentsIntersect(input.observer, input.target, wall.a, wall.b)) {
      return { kind: "blocked", reason: "wall" };
    }
  }

  const stacked = totalCoverThicknessOnRay(input.observer, input.target, input.covers);
  if (stacked <= EPS) return { kind: "clear" };

  if (!input.profile.considersCoverThickness) {
    return { kind: "blocked", reason: "cover" };
  }

  if (input.penetration + EPS >= stacked) {
    return { kind: "through_cover", stackedThickness: stacked };
  }

  if (input.hasLocatedShot && input.profile.allowsLocatedShotThroughCover) {
    return { kind: "through_cover", stackedThickness: stacked };
  }

  return { kind: "blocked", reason: "cover" };
}

export function canDealDamageThroughCover(input: CoverEngagementInput): boolean {
  const result = resolveCoverEngagement(input);
  return result.kind === "clear" || result.kind === "through_cover";
}
