import type { ElementBounds } from "./combat-map-element-geometry.ts";

export type RectRotation = { deg: number; cx: number; cy: number };

export function parseRectRotation(transform: string | undefined): RectRotation | null {
  if (!transform) return null;
  const m = /rotate\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)/i.exec(transform);
  if (!m) return null;
  const deg = Number(m[1]);
  const cx = Number(m[2]);
  const cy = Number(m[3]);
  if (![deg, cx, cy].every(Number.isFinite)) return null;
  return { deg, cx, cy };
}

export function formatRectRotation(rotation: RectRotation): string {
  const deg = round1(normalizeDegrees(rotation.deg));
  if (Math.abs(deg) < 1e-6) return "";
  return `rotate(${deg} ${round1(rotation.cx)} ${round1(rotation.cy)})`;
}

export function normalizeDegrees(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

export function pointerAngleDeg(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

export const COMBAT_MAP_ROTATION_SNAP_STEPS = [15, 30, 45, 60, 90] as const;

export function combatMapRotationSnapAngles(): readonly number[] {
  const set = new Set<number>();
  for (const step of COMBAT_MAP_ROTATION_SNAP_STEPS) {
    for (let deg = 0; deg < 360; deg += step) set.add(deg);
  }
  return [...set].sort((a, b) => a - b);
}

export function snapRotationDegrees(deg: number): number {
  const base = ((deg % 360) + 360) % 360;
  let bestNorm = base;
  let bestDist = Infinity;
  for (const angle of combatMapRotationSnapAngles()) {
    const dist = Math.min(Math.abs(base - angle), 360 - Math.abs(base - angle));
    if (dist < bestDist) {
      bestDist = dist;
      bestNorm = angle;
    }
  }
  return deg - base + bestNorm;
}

export function rectRotationCenter(
  bounds: ElementBounds,
  rotation: RectRotation | null,
): { cx: number; cy: number } {
  if (rotation) return { cx: rotation.cx, cy: rotation.cy };
  return { cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2 };
}

export function rotatePoint(
  p: { x: number; y: number },
  cx: number,
  cy: number,
  deg: number,
): { x: number; y: number } {
  if (Math.abs(deg) < 1e-9) return p;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Local rect corners: nw, ne, se, sw. */
export function rectLocalCorners(bounds: ElementBounds): { x: number; y: number }[] {
  const { x, y, width: w, height: h } = bounds;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function rectWorldCorners(
  bounds: ElementBounds,
  rotation: RectRotation | null,
): { x: number; y: number }[] {
  const local = rectLocalCorners(bounds);
  if (!rotation || Math.abs(rotation.deg) < 1e-9) return local;
  return local.map((p) => rotatePoint(p, rotation.cx, rotation.cy, rotation.deg));
}

export function boundsFromPoints(points: readonly { x: number; y: number }[]): ElementBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
