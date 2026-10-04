import { parseCombatMapElements, updateCombatMapElement } from "./combat-map-document.ts";
import {
  combatMapElementBounds,
  patchElementToBounds,
  type ElementBounds,
} from "./combat-map-element-geometry.ts";
import { rectElementIsRotated } from "./combat-map-rotate.ts";
import {
  COMBAT_MAP_HANDLE_SCREEN_PX,
  mapSvgToScreen,
  type MapViewportPan,
  type ScreenRect,
  type SvgViewBox,
} from "./combat-map-viewport.ts";

export { patchElementToBounds } from "./combat-map-element-geometry.ts";

export type ScaleHandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const SCALE_HANDLE_IDS: readonly ScaleHandleId[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

const OPPOSITE_CORNER: Partial<Record<ScaleHandleId, ScaleHandleId>> = {
  nw: "se",
  ne: "sw",
  se: "nw",
  sw: "ne",
};

const EDGE_ENDS: Record<"n" | "e" | "s" | "w", [ScaleHandleId, ScaleHandleId]> = {
  n: ["nw", "ne"],
  e: ["ne", "se"],
  s: ["sw", "se"],
  w: ["nw", "sw"],
};

function isEdgeScaleHandle(handle: ScaleHandleId): handle is "n" | "e" | "s" | "w" {
  return handle === "n" || handle === "e" || handle === "s" || handle === "w";
}

export function scaleHandleScreenVector(
  handles: Record<ScaleHandleId, { x: number; y: number }>,
  handle: ScaleHandleId,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
): { dx: number; dy: number } {
  if (isEdgeScaleHandle(handle)) {
    const [a, b] = EDGE_ENDS[handle];
    const start = mapSvgToScreen(handles[a].x, handles[a].y, viewBox, pan, scale);
    const end = mapSvgToScreen(handles[b].x, handles[b].y, viewBox, pan, scale);
    return { dx: end.x - start.x, dy: end.y - start.y };
  }
  const opposite = OPPOSITE_CORNER[handle];
  if (!opposite) return { dx: 1, dy: 0 };
  const corner = mapSvgToScreen(handles[handle].x, handles[handle].y, viewBox, pan, scale);
  const other = mapSvgToScreen(handles[opposite].x, handles[opposite].y, viewBox, pan, scale);
  return { dx: other.x - corner.x, dy: other.y - corner.y };
}

function cornerCursorFromScreenVector(dx: number, dy: number): string {
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const bucket = Math.round(angle / 45) % 8;
  return (
    [
      "ew-resize",
      "nwse-resize",
      "ns-resize",
      "nesw-resize",
      "ew-resize",
      "nwse-resize",
      "ns-resize",
      "nesw-resize",
    ] as const
  )[bucket]!;
}

export function scaleHandleScreenCursor(
  handles: Record<ScaleHandleId, { x: number; y: number }>,
  handle: ScaleHandleId,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
): string {
  const { dx, dy } = scaleHandleScreenVector(handles, handle, viewBox, pan, scale);
  if (isEdgeScaleHandle(handle)) {
    return Math.abs(dx) >= Math.abs(dy) ? "ns-resize" : "ew-resize";
  }
  return cornerCursorFromScreenVector(dx, dy);
}

export function scaleHandleScreenRect(
  svgX: number,
  svgY: number,
  handle: ScaleHandleId,
  handles: Record<ScaleHandleId, { x: number; y: number }>,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
  sizePx = COMBAT_MAP_HANDLE_SCREEN_PX,
): ScreenRect {
  const center = mapSvgToScreen(svgX, svgY, viewBox, pan, scale);
  if (!isEdgeScaleHandle(handle)) {
    return {
      x: center.x - sizePx / 2,
      y: center.y - sizePx / 2,
      width: sizePx,
      height: sizePx,
    };
  }
  const { dx, dy } = scaleHandleScreenVector(handles, handle, viewBox, pan, scale);
  const long = sizePx * 1.75;
  const short = Math.max(sizePx * 0.75, 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: center.x - long / 2, y: center.y - short / 2, width: long, height: short };
  }
  return { x: center.x - short / 2, y: center.y - long / 2, width: short, height: long };
}

export function scaleHandlePositions(bounds: ElementBounds): Record<ScaleHandleId, { x: number; y: number }> {
  const { x, y, width: w, height: h } = bounds;
  const mx = x + w / 2;
  const my = y + h / 2;
  return {
    nw: { x, y },
    n: { x: mx, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: my },
    se: { x: x + w, y: y + h },
    s: { x: mx, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: my },
  };
}

export function boundsFromHandleDrag(
  origin: ElementBounds,
  handle: ScaleHandleId,
  pt: { x: number; y: number },
  minSize = 1,
): ElementBounds {
  const left = origin.x;
  const top = origin.y;
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  let x1 = left;
  let y1 = top;
  let x2 = right;
  let y2 = bottom;

  if (handle === "nw" || handle === "w" || handle === "sw") x1 = pt.x;
  if (handle === "ne" || handle === "e" || handle === "se") x2 = pt.x;
  if (handle === "nw" || handle === "n" || handle === "ne") y1 = pt.y;
  if (handle === "sw" || handle === "s" || handle === "se") y2 = pt.y;

  if (x2 - x1 < minSize) {
    if (handle === "nw" || handle === "w" || handle === "sw") x1 = x2 - minSize;
    else x2 = x1 + minSize;
  }
  if (y2 - y1 < minSize) {
    if (handle === "nw" || handle === "n" || handle === "ne") y1 = y2 - minSize;
    else y2 = y1 + minSize;
  }

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function resizeCombatMapElement(
  originSvg: string,
  id: string,
  bounds: ElementBounds,
): string {
  const el = parseCombatMapElements(originSvg).find((e) => e.id === id);
  if (!el) return originSvg;
  const patch = patchElementToBounds(el, bounds);
  if (!Object.keys(patch).length) return originSvg;
  return updateCombatMapElement(originSvg, id, patch);
}

/** Scale from the axis-aligned bounds and drop rotation on the element. */
export function resizeCombatMapRectIgnoringRotation(
  originSvg: string,
  id: string,
  originAabb: ElementBounds,
  handle: ScaleHandleId,
  pointer: { x: number; y: number },
  minSize = 1,
): string {
  const el = parseCombatMapElements(originSvg).find((entry) => entry.id === id);
  if (!el) return originSvg;
  const newAabb = boundsFromHandleDrag(originAabb, handle, pointer, minSize);
  const patch: Record<string, string | undefined> = {
    ...patchElementToBounds(el, newAabb),
  };
  if (rectElementIsRotated(el)) patch.transform = undefined;
  if (!Object.keys(patch).length) return originSvg;
  return updateCombatMapElement(originSvg, id, patch);
}
