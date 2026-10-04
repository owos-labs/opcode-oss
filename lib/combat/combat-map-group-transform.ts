import type { CombatMapElement } from "./combat-map-document.ts";
import {
  moveCombatMapElement,
  parseCombatMapElements,
  updateCombatMapElement,
} from "./combat-map-document.ts";
import {
  combatMapElementBounds,
  combatMapElementCenter,
  patchElementToBounds,
  type ElementBounds,
} from "./combat-map-element-geometry.ts";
import { formatPathD, parsePathD, pathIsClosed } from "./combat-map-path.ts";
import {
  boundsFromHandleDrag,
  scaleHandlePositions,
  type ScaleHandleId,
} from "./combat-map-scale.ts";
import {
  CORNER_IDS,
  pointerOutsideCorner,
  rectElementIsRotated,
  rectElementRotation,
  rectLocalBounds,
  type RectCornerInteraction,
  updateCombatMapElementRotation,
} from "./combat-map-rotate.ts";
import {
  COMBAT_MAP_HANDLE_SCREEN_PX,
  COMBAT_MAP_ROTATE_ZONE_OUTER_PX,
} from "./combat-map-viewport.ts";
import { formatRectRotation, parseRectRotation, rotatePoint } from "./combat-map-transform.ts";

export function transformableSelectionIds(
  elements: readonly CombatMapElement[],
  ids: readonly string[],
): string[] {
  return ids.filter((id) => {
    const el = elements.find((entry) => entry.id === id);
    return !!el && el.kind !== "bounding_box";
  });
}

export function selectionGroupBounds(
  elements: readonly CombatMapElement[],
  ids: readonly string[],
): ElementBounds | null {
  const transformIds = transformableSelectionIds(elements, ids);
  if (transformIds.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of transformIds) {
    const el = elements.find((entry) => entry.id === id);
    const bounds = el ? combatMapElementBounds(el) : null;
    if (!bounds) continue;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const CORNER_SCALE_HANDLE: Record<(typeof CORNER_IDS)[number], ScaleHandleId> = {
  nw: "nw",
  ne: "ne",
  se: "se",
  sw: "sw",
};

export function pickGroupCornerInteraction(
  groupBounds: ElementBounds,
  pointerSvg: { x: number; y: number },
  viewportScale: number,
): RectCornerInteraction | null {
  const corners = scaleHandlePositions(groupBounds);
  const pivot = {
    cx: groupBounds.x + groupBounds.width / 2,
    cy: groupBounds.y + groupBounds.height / 2,
  };
  const scaleRadiusSvg = (COMBAT_MAP_HANDLE_SCREEN_PX * 1.25) / Math.max(viewportScale, 1e-9);
  const rotateOuterSvg = COMBAT_MAP_ROTATE_ZONE_OUTER_PX / Math.max(viewportScale, 1e-9);

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

export function pointInBounds(
  pt: { x: number; y: number },
  bounds: ElementBounds,
): boolean {
  return (
    pt.x >= bounds.x &&
    pt.x <= bounds.x + bounds.width &&
    pt.y >= bounds.y &&
    pt.y <= bounds.y + bounds.height
  );
}

function scaleAnchor(handle: ScaleHandleId, bounds: ElementBounds): { x: number; y: number } {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const mx = bounds.x + bounds.width / 2;
  const my = bounds.y + bounds.height / 2;
  switch (handle) {
    case "nw":
      return { x: right, y: bottom };
    case "n":
      return { x: mx, y: bottom };
    case "ne":
      return { x: bounds.x, y: bottom };
    case "e":
      return { x: bounds.x, y: my };
    case "se":
      return { x: bounds.x, y: bounds.y };
    case "s":
      return { x: mx, y: bounds.y };
    case "sw":
      return { x: right, y: bounds.y };
    case "w":
      return { x: right, y: my };
  }
}

function patchRotatedRectGroupScale(
  el: CombatMapElement,
  anchor: { x: number; y: number },
  sx: number,
  sy: number,
  minSize: number,
): Record<string, string> {
  const local = rectLocalBounds(el);
  const rotation = rectElementRotation(el);
  if (!local || !rotation) return {};
  const cx = local.x + local.width / 2;
  const cy = local.y + local.height / 2;
  const newCx = anchor.x + (cx - anchor.x) * sx;
  const newCy = anchor.y + (cy - anchor.y) * sy;
  const newW = Math.max(minSize, local.width * Math.abs(sx));
  const newH = Math.max(minSize, local.height * Math.abs(sy));
  return {
    x: String(Math.round((newCx - newW / 2) * 10) / 10),
    y: String(Math.round((newCy - newH / 2) * 10) / 10),
    width: String(Math.round(newW * 10) / 10),
    height: String(Math.round(newH * 10) / 10),
    transform: formatRectRotation({ deg: rotation.deg, cx: newCx, cy: newCy }),
  };
}

function scaleBoundsFromGroup(
  from: ElementBounds,
  anchor: { x: number; y: number },
  sx: number,
  sy: number,
): ElementBounds {
  const x2 = from.x + from.width;
  const y2 = from.y + from.height;
  const nx = anchor.x + (from.x - anchor.x) * sx;
  const ny = anchor.y + (from.y - anchor.y) * sy;
  const nx2 = anchor.x + (x2 - anchor.x) * sx;
  const ny2 = anchor.y + (y2 - anchor.y) * sy;
  return {
    x: Math.min(nx, nx2),
    y: Math.min(ny, ny2),
    width: Math.abs(nx2 - nx),
    height: Math.abs(ny2 - ny),
  };
}

export function resizeCombatMapSelection(
  originSvg: string,
  ids: readonly string[],
  originGroupBounds: ElementBounds,
  handle: ScaleHandleId,
  pt: { x: number; y: number },
  minSize = 1,
): string {
  const elements = parseCombatMapElements(originSvg);
  const transformIds = transformableSelectionIds(elements, ids);
  if (transformIds.length === 0) return originSvg;

  const nextGroup = boundsFromHandleDrag(originGroupBounds, handle, pt, minSize);
  const sx = originGroupBounds.width > 0 ? nextGroup.width / originGroupBounds.width : 1;
  const sy = originGroupBounds.height > 0 ? nextGroup.height / originGroupBounds.height : 1;
  const anchor = scaleAnchor(handle, originGroupBounds);

  let next = originSvg;
  for (const id of transformIds) {
    const el = elements.find((entry) => entry.id === id);
    if (!el) continue;
    if (el.tag === "rect" && rectElementIsRotated(el)) {
      const patch = patchRotatedRectGroupScale(el, anchor, sx, sy, minSize);
      if (!Object.keys(patch).length) continue;
      next = updateCombatMapElement(next, id, patch);
      continue;
    }
    const from = el.tag === "rect" ? rectLocalBounds(el) : combatMapElementBounds(el);
    if (!from) continue;
    const patch = patchElementToBounds(el, scaleBoundsFromGroup(from, anchor, sx, sy));
    if (!Object.keys(patch).length) continue;
    next = updateCombatMapElement(next, id, patch);
  }
  return next;
}

function rotatePathD(d: string, pivot: { x: number; y: number }, deg: number): string {
  const closed = pathIsClosed(d);
  const points = parsePathD(d).map((p) => rotatePoint(p, pivot.x, pivot.y, deg));
  return formatPathD(points, closed);
}

export function rotateCombatMapSelection(
  originSvg: string,
  ids: readonly string[],
  pivot: { x: number; y: number },
  deltaDeg: number,
): string {
  if (Math.abs(deltaDeg) < 1e-9) return originSvg;
  const elements = parseCombatMapElements(originSvg);
  const transformIds = transformableSelectionIds(elements, ids);
  if (transformIds.length === 0) return originSvg;

  let next = originSvg;
  for (const id of transformIds) {
    const el = elements.find((entry) => entry.id === id);
    if (!el) continue;

    if (el.tag === "path" && el.attrs.d) {
      next = updateCombatMapElement(next, id, { d: rotatePathD(el.attrs.d, pivot, deltaDeg) });
      continue;
    }

    if (el.tag === "circle") {
      const cx = Number(el.attrs.cx);
      const cy = Number(el.attrs.cy);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const rotated = rotatePoint({ x: cx, y: cy }, pivot.x, pivot.y, deltaDeg);
      next = updateCombatMapElement(next, id, {
        cx: String(Math.round(rotated.x * 10) / 10),
        cy: String(Math.round(rotated.y * 10) / 10),
      });
      continue;
    }

    if (el.tag === "rect") {
      const center = combatMapElementCenter(el);
      if (!center) continue;
      const rotated = rotatePoint(center, pivot.x, pivot.y, deltaDeg);
      const dx = rotated.x - center.x;
      const dy = rotated.y - center.y;
      next = moveCombatMapElement(next, id, dx, dy);
      const originDeg = parseRectRotation(el.attrs.transform)?.deg ?? 0;
      next = updateCombatMapElementRotation(next, id, originDeg + deltaDeg);
    }
  }
  return next;
}
