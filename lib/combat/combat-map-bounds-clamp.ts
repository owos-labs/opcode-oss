import type { CombatMapElement } from "./combat-map-document.ts";
import { combatMapElementBounds, type ElementBounds } from "./combat-map-element-geometry.ts";
import { parsePathD } from "./combat-map-path.ts";

export type MapArtboard = { x: number; y: number; w: number; h: number };

export function mapArtboardFromAttrs(attrs: Record<string, string>): MapArtboard {
  return {
    x: Number(attrs.x ?? 0),
    y: Number(attrs.y ?? 0),
    w: Number(attrs.width ?? 0),
    h: Number(attrs.height ?? 0),
  };
}

export function clampRectToArtboard(
  bounds: ElementBounds,
  artboard: MapArtboard,
  minSize = 1,
): ElementBounds {
  const right = artboard.x + artboard.w;
  const bottom = artboard.y + artboard.h;
  const width = Math.max(minSize, Math.min(bounds.width, artboard.w));
  const height = Math.max(minSize, Math.min(bounds.height, artboard.h));
  const x = Math.max(artboard.x, Math.min(bounds.x, right - width));
  const y = Math.max(artboard.y, Math.min(bounds.y, bottom - height));
  return { x, y, width, height };
}

export function intersectRectWithArtboard(
  x: number,
  y: number,
  width: number,
  height: number,
  artboard: MapArtboard,
  minSize = 1,
): ElementBounds | null {
  const x1 = Math.max(artboard.x, x);
  const y1 = Math.max(artboard.y, y);
  const x2 = Math.min(artboard.x + artboard.w, x + width);
  const y2 = Math.min(artboard.y + artboard.h, y + height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w < minSize || h < minSize) return null;
  return { x: x1, y: y1, width: w, height: h };
}

export function clampMoveDeltaForBounds(
  bounds: ElementBounds,
  dx: number,
  dy: number,
  artboard: MapArtboard,
): { dx: number; dy: number } {
  const clamped = clampRectToArtboard(
    { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height },
    artboard,
  );
  return { dx: clamped.x - bounds.x, dy: clamped.y - bounds.y };
}

export function clampPathMoveDelta(
  d: string,
  dx: number,
  dy: number,
  artboard: MapArtboard,
): { dx: number; dy: number } {
  const pts = parsePathD(d);
  if (!pts.length) return { dx, dy };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const tx = p.x + dx;
    const ty = p.y + dy;
    minX = Math.min(minX, tx);
    minY = Math.min(minY, ty);
    maxX = Math.max(maxX, tx);
    maxY = Math.max(maxY, ty);
  }
  let fixDx = 0;
  let fixDy = 0;
  if (minX < artboard.x) fixDx = artboard.x - minX;
  if (minY < artboard.y) fixDy = artboard.y - minY;
  if (maxX + fixDx > artboard.x + artboard.w) fixDx = artboard.x + artboard.w - maxX;
  if (maxY + fixDy > artboard.y + artboard.h) fixDy = artboard.y + artboard.h - maxY;
  return { dx: dx + fixDx, dy: dy + fixDy };
}

export function clampPointToArtboard(
  x: number,
  y: number,
  artboard: MapArtboard,
): { x: number; y: number } {
  return {
    x: Math.max(artboard.x, Math.min(x, artboard.x + artboard.w)),
    y: Math.max(artboard.y, Math.min(y, artboard.y + artboard.h)),
  };
}

export function clampCircleCenterToArtboard(
  cx: number,
  cy: number,
  r: number,
  artboard: MapArtboard,
): { cx: number; cy: number } {
  const clamped = clampRectToArtboard({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, artboard);
  return { cx: clamped.x + r, cy: clamped.y + r };
}

export function shouldClampMapElement(el: CombatMapElement): boolean {
  return el.kind !== "bounding_box";
}
