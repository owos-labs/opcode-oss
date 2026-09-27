import type { CharacterActor } from "./actor.ts";

/** 2D combat map: walls/cover are segments; character actors are points (see actor.ts). */

export type Vec2 = { x: number; y: number };

export type WallSegment = { a: Vec2; b: Vec2 };

/** @deprecated Use CharacterActor — same shape, zero-size combatant. */
export type VisibleTarget = CharacterActor;

/** What an actor (NPC or player peer) may reason about this tick. */
export type InformationBoundary = {
  visibleIds: readonly string[];
};

const EPS = 1e-6;

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    Math.min(a.x, b.x) - EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}

/** Segment intersection; endpoint-only touches do not block (LOS may graze corners). */
export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const o1 = cross(sub(p2, p1), sub(p3, p1));
  const o2 = cross(sub(p2, p1), sub(p4, p1));
  const o3 = cross(sub(p4, p3), sub(p1, p3));
  const o4 = cross(sub(p4, p3), sub(p2, p3));

  if (o1 * o2 < -EPS && o3 * o4 < -EPS) return true;

  if (Math.abs(o1) <= EPS && onSegment(p1, p2, p3)) return true;
  if (Math.abs(o2) <= EPS && onSegment(p1, p2, p4)) return true;
  if (Math.abs(o3) <= EPS && onSegment(p3, p4, p1)) return true;
  if (Math.abs(o4) <= EPS && onSegment(p3, p4, p2)) return true;

  return false;
}

/** Raycast between two points (e.g. observer eye and actor position). */
export function hasLineOfSight(
  observer: Vec2,
  target: Vec2,
  walls: readonly WallSegment[],
): boolean {
  for (const wall of walls) {
    if (segmentsIntersect(observer, target, wall.a, wall.b)) return false;
  }
  return true;
}

/** Builds the information-boundary list: ids of targets with clear LOS from the observer. */
export function visibleActorIds(
  observer: Vec2,
  actors: readonly CharacterActor[],
  walls: readonly WallSegment[],
): string[] {
  const ids: string[] = [];
  for (const actor of actors) {
    if (hasLineOfSight(observer, actor.position, walls)) ids.push(actor.id);
  }
  return ids;
}

/** @deprecated Use visibleActorIds */
export function visibleTargetIds(
  observer: Vec2,
  targets: readonly CharacterActor[],
  walls: readonly WallSegment[],
): string[] {
  return visibleActorIds(observer, targets, walls);
}

export function computeInformationBoundary(
  observer: Vec2,
  actors: readonly CharacterActor[],
  walls: readonly WallSegment[],
): InformationBoundary {
  return { visibleIds: visibleActorIds(observer, actors, walls) };
}

/** Drops entries not in the boundary list (same list drives Expert NPC and player peer). */
export function filterIdsByBoundary<T extends { id: string }>(
  items: readonly T[],
  boundary: InformationBoundary,
): T[] {
  const allowed = new Set(boundary.visibleIds);
  return items.filter(item => allowed.has(item.id));
}
