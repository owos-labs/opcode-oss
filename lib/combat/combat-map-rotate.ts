import type { CombatMapElement } from "./combat-map-document.ts";
import { parseCombatMapElements, updateCombatMapElement } from "./combat-map-document.ts";
import type { ElementBounds } from "./combat-map-element-geometry.ts";
import { boundsFromHandleDrag, type ScaleHandleId } from "./combat-map-scale.ts";
import {
  COMBAT_MAP_HANDLE_SCREEN_PX,
  COMBAT_MAP_ROTATE_ZONE_OUTER_PX,
} from "./combat-map-viewport.ts";
import {
  formatRectRotation,
  parseRectRotation,
  pointerAngleDeg,
  rectRotationCenter,
  rectWorldCorners,
  rotatePoint,
  snapRotationDegrees,
  type RectRotation,
} from "./combat-map-transform.ts";

export { pointerAngleDeg, rectRotationCenter };

export type CornerId = "nw" | "ne" | "se" | "sw";

export const CORNER_IDS: readonly CornerId[] = ["nw", "ne", "se", "sw"];

const CORNER_SCALE_HANDLE: Record<CornerId, ScaleHandleId> = {
  nw: "nw",
  ne: "ne",
  se: "se",
  sw: "sw",
};

export type RectCornerInteraction =
  | { kind: "scale"; handle: ScaleHandleId }
  | { kind: "rotate"; corner: CornerId };

export function canRotateCombatMapElement(el: CombatMapElement | null | undefined): boolean {
  if (!el || el.tag !== "rect") return false;
  return el.kind === "barrier" || el.kind === "concealment" || el.kind === "room";
}

export function rectLocalBounds(el: CombatMapElement): ElementBounds | null {
  if (el.tag !== "rect") return null;
  const x = Number(el.attrs.x ?? 0);
  const y = Number(el.attrs.y ?? 0);
  const width = Number(el.attrs.width ?? 0);
  const height = Number(el.attrs.height ?? 0);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

export function rectElementRotation(el: CombatMapElement): RectRotation | null {
  return parseRectRotation(el.attrs.transform);
}

export function rectElementIsRotated(el: CombatMapElement): boolean {
  const rotation = rectElementRotation(el);
  return !!rotation && Math.abs(rotation.deg) > 0.5;
}

export function rectCornerWorldPositions(
  el: CombatMapElement,
): Record<CornerId, { x: number; y: number }> | null {
  const bounds = rectLocalBounds(el);
  if (!bounds) return null;
  const [nw, ne, se, sw] = rectWorldCorners(bounds, rectElementRotation(el));
  return { nw, ne, se, sw };
}

/** Pointer is on the outside of a corner (away from the rotation pivot). */
export function pointerOutsideCorner(
  pointer: { x: number; y: number },
  corner: { x: number; y: number },
  pivot: { cx: number; cy: number },
): boolean {
  const outX = corner.x - pivot.cx;
  const outY = corner.y - pivot.cy;
  const toPtrX = pointer.x - corner.x;
  const toPtrY = pointer.y - corner.y;
  return toPtrX * outX + toPtrY * outY >= 0;
}

export function pickRectCornerInteraction(
  el: CombatMapElement,
  pointerSvg: { x: number; y: number },
  viewportScale: number,
): RectCornerInteraction | null {
  if (!canRotateCombatMapElement(el)) return null;
  const corners = rectCornerWorldPositions(el);
  const bounds = rectLocalBounds(el);
  if (!corners || !bounds) return null;

  const pivot = rectRotationCenter(bounds, rectElementRotation(el));
  const scaleRadiusSvg = (COMBAT_MAP_HANDLE_SCREEN_PX * 1.25) / Math.max(viewportScale, 1e-9);
  const rotateOuterSvg = COMBAT_MAP_ROTATE_ZONE_OUTER_PX / Math.max(viewportScale, 1e-9);
  const rotated = rectElementIsRotated(el);

  let scaleHit: RectCornerInteraction | null = null;
  let scaleDist = Infinity;
  let rotateHit: RectCornerInteraction | null = null;
  let rotateDist = Infinity;

  for (const cornerId of CORNER_IDS) {
    const corner = corners[cornerId];
    const dist = Math.hypot(pointerSvg.x - corner.x, pointerSvg.y - corner.y);
    if (dist <= scaleRadiusSvg && dist < scaleDist) {
      scaleHit = { kind: "scale", handle: CORNER_SCALE_HANDLE[cornerId] };
      scaleDist = dist;
    }
    if (
      dist > scaleRadiusSvg &&
      dist <= rotateOuterSvg &&
      pointerOutsideCorner(pointerSvg, corner, pivot) &&
      dist < rotateDist
    ) {
      rotateHit = { kind: "rotate", corner: cornerId };
      rotateDist = dist;
    }
  }

  return scaleHit ?? rotateHit;
}

export function patchRectRotation(el: CombatMapElement, deg: number): Record<string, string | undefined> {
  const bounds = rectLocalBounds(el);
  if (!bounds) return {};
  const center = rectRotationCenter(bounds, rectElementRotation(el));
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized < 0.5 || normalized > 359.5) return { transform: undefined };
  return { transform: formatRectRotation({ deg: normalized, cx: center.cx, cy: center.cy }) };
}

export function updateCombatMapElementRotation(svg: string, id: string, deg: number): string {
  const el = parseCombatMapElements(svg).find((entry) => entry.id === id);
  if (!el) return svg;
  const patch = patchRectRotation(el, deg);
  if (!Object.keys(patch).length) return svg;
  return updateCombatMapElement(svg, id, patch);
}

export function rotationDragDegrees(
  originDeg: number,
  startPointerDeg: number,
  pointerDeg: number,
  snap = false,
): number {
  let next = originDeg + (pointerDeg - startPointerDeg);
  if (snap) next = snapRotationDegrees(next);
  return next;
}

export function orientedScaleHandlePositions(
  el: CombatMapElement,
): Record<ScaleHandleId, { x: number; y: number }> | null {
  const bounds = rectLocalBounds(el);
  if (!bounds) return null;
  const rotation = rectElementRotation(el);
  const [nw, ne, se, sw] = rectWorldCorners(bounds, rotation);
  return {
    nw,
    n: { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 },
    ne,
    e: { x: (ne.x + se.x) / 2, y: (ne.y + se.y) / 2 },
    se,
    s: { x: (sw.x + se.x) / 2, y: (sw.y + se.y) / 2 },
    sw,
    w: { x: (nw.x + sw.x) / 2, y: (nw.y + sw.y) / 2 },
  };
}

export function selectionOutlineCorners(el: CombatMapElement): { x: number; y: number }[] | null {
  if (!rectElementIsRotated(el)) return null;
  const bounds = rectLocalBounds(el);
  if (!bounds) return null;
  return rectWorldCorners(bounds, rectElementRotation(el));
}

function round1Attr(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function patchOrientedRectFromHandleDrag(
  el: CombatMapElement,
  handle: ScaleHandleId,
  pointerWorld: { x: number; y: number },
  minSize = 1,
): Record<string, string | undefined> {
  const bounds = rectLocalBounds(el);
  if (!bounds) return {};
  const rotation = rectElementRotation(el);
  const pointerLocal = rotation
    ? rotatePoint(pointerWorld, rotation.cx, rotation.cy, -rotation.deg)
    : pointerWorld;
  const newBounds = boundsFromHandleDrag(bounds, handle, pointerLocal, minSize);
  const patch: Record<string, string | undefined> = {
    x: round1Attr(newBounds.x),
    y: round1Attr(newBounds.y),
    width: round1Attr(newBounds.width),
    height: round1Attr(newBounds.height),
  };
  if (rotation && Math.abs(rotation.deg) > 0.5) {
    const center = rectRotationCenter(newBounds, null);
    patch.transform = formatRectRotation({ deg: rotation.deg, cx: center.cx, cy: center.cy });
  }
  return patch;
}

export function resizeOrientedCombatMapElement(
  originSvg: string,
  id: string,
  handle: ScaleHandleId,
  pointerWorld: { x: number; y: number },
  minSize = 1,
): string {
  const el = parseCombatMapElements(originSvg).find((entry) => entry.id === id);
  if (!el) return originSvg;
  const patch = patchOrientedRectFromHandleDrag(el, handle, pointerWorld, minSize);
  if (!Object.keys(patch).length) return originSvg;
  return updateCombatMapElement(originSvg, id, patch);
}
