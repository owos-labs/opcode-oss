import type { CombatMapElement } from "./combat-map-document.ts";
import { boundsFromPoints, parseRectRotation, rectWorldCorners } from "./combat-map-transform.ts";
import { formatPathD, parsePathD, pathIsClosed } from "./combat-map-path.ts";

export type ElementBounds = { x: number; y: number; width: number; height: number };

export function combatMapElementBounds(el: CombatMapElement): ElementBounds | null {
  if (el.tag === "rect") {
    const x = Number(el.attrs.x ?? 0);
    const y = Number(el.attrs.y ?? 0);
    const width = Number(el.attrs.width ?? 0);
    const height = Number(el.attrs.height ?? 0);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    const local = { x, y, width, height };
    const rotation = parseRectRotation(el.attrs.transform);
    if (!rotation || Math.abs(rotation.deg) < 1e-9) return local;
    return boundsFromPoints(rectWorldCorners(local, rotation));
  }
  if (el.tag === "circle") {
    const cx = Number(el.attrs.cx);
    const cy = Number(el.attrs.cy);
    const r = Number(el.attrs.r ?? 14);
    if (![cx, cy, r].every(Number.isFinite)) return null;
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
  }
  if (el.tag === "path" && el.attrs.d) {
    const pts = parsePathD(el.attrs.d);
    if (!pts.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return null;
}

export function combatMapElementCenter(el: CombatMapElement): { x: number; y: number } | null {
  if (el.tag === "circle") {
    const cx = Number(el.attrs.cx);
    const cy = Number(el.attrs.cy);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    return { x: cx, y: cy };
  }
  if (el.tag === "rect") {
    const x = Number(el.attrs.x ?? 0);
    const y = Number(el.attrs.y ?? 0);
    const w = Number(el.attrs.width ?? 0);
    const h = Number(el.attrs.height ?? 0);
    return { x: x + w / 2, y: y + h / 2 };
  }
  if (el.tag === "path" && el.attrs.d) {
    const pts = parsePathD(el.attrs.d);
    if (!pts.length) return null;
    return {
      x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
      y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
    };
  }
  return null;
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function scalePathDToBounds(d: string, from: ElementBounds, to: ElementBounds): string {
  if (from.width <= 0 || from.height <= 0) return d;
  const closed = pathIsClosed(d);
  const points = parsePathD(d).map((p) => ({
    x: to.x + ((p.x - from.x) / from.width) * to.width,
    y: to.y + ((p.y - from.y) / from.height) * to.height,
  }));
  return formatPathD(points, closed);
}

export function patchElementToBounds(el: CombatMapElement, bounds: ElementBounds): Record<string, string> {
  if (el.tag === "rect") {
    return {
      x: round1(bounds.x),
      y: round1(bounds.y),
      width: round1(bounds.width),
      height: round1(bounds.height),
    };
  }
  if (el.tag === "circle") {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const r = Math.max(bounds.width, bounds.height) / 2;
    return { cx: round1(cx), cy: round1(cy), r: round1(r) };
  }
  if (el.tag === "path" && el.attrs.d) {
    const from = combatMapElementBounds(el);
    if (!from) return {};
    return { d: scalePathDToBounds(el.attrs.d, from, bounds) };
  }
  return {};
}
