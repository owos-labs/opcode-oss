import { boundingBoxElement } from "./combat-map-document.ts";

export type MapViewportPan = { x: number; y: number };
export type ViewportInsets = { top: number; right: number; bottom: number; left: number };
export type ArtboardRect = { x: number; y: number; w: number; h: number };
export type SvgViewBox = { x: number; y: number; w: number; h: number };
export type MapSvgRect = { minX: number; minY: number; maxX: number; maxY: number };

export const COMBAT_MAP_EDIT_UI_INSETS: ViewportInsets = {
  top: 64,
  right: 24,
  bottom: 88,
  left: 24,
};

export const COMBAT_MAP_PLAY_UI_INSETS: ViewportInsets = {
  top: 64,
  right: 24,
  bottom: 72,
  left: 24,
};

/** Same client → map-local math as CombatBenchMap (viewBox units = canvas pixels). */
export function svgPointAtClient(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  pan: MapViewportPan,
  scale: number,
): { x: number; y: number } {
  return {
    x: (clientX - viewportRect.left - pan.x) / scale,
    y: (clientY - viewportRect.top - pan.y) / scale,
  };
}

/** Screen drag delta → map units; stable while viewBox origin moves (e.g. artboard drag). */
export function mapDeltaFromClientDrag(
  clientX: number,
  clientY: number,
  startClientX: number,
  startClientY: number,
  scale: number,
): { dx: number; dy: number } {
  return {
    dx: (clientX - startClientX) / scale,
    dy: (clientY - startClientY) / scale,
  };
}

export function mapPointFromClientDrag(
  origin: { x: number; y: number },
  clientX: number,
  clientY: number,
  startClientX: number,
  startClientY: number,
  scale: number,
): { x: number; y: number } {
  const { dx, dy } = mapDeltaFromClientDrag(clientX, clientY, startClientX, startClientY, scale);
  return { x: origin.x + dx, y: origin.y + dy };
}

/** Client point → SVG user units when the visible frame is the bounding box. */
export function svgPointAtClientInFrame(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  pan: MapViewportPan,
  scale: number,
  frame: ArtboardRect,
): { x: number; y: number } {
  const local = svgPointAtClient(clientX, clientY, viewportRect, pan, scale);
  return { x: local.x + frame.x, y: local.y + frame.y };
}

export function centerPanOnSvgPoint(
  svgX: number,
  svgY: number,
  viewportRect: DOMRect,
  pan: MapViewportPan,
  scale: number,
): MapViewportPan {
  const screenX = viewportRect.left + pan.x + svgX * scale;
  const screenY = viewportRect.top + pan.y + svgY * scale;
  return {
    x: pan.x + (viewportRect.left + viewportRect.width / 2 - screenX),
    y: pan.y + (viewportRect.top + viewportRect.height / 2 - screenY),
  };
}

/** Fit map canvas into viewport; never zooms in past 1×. */
export function fitCombatMapToViewport(
  viewBox: { w: number; h: number },
  viewportSize: { width: number; height: number },
  padding = 24,
): { pan: MapViewportPan; scale: number } {
  const innerW = Math.max(viewportSize.width - padding, 1);
  const innerH = Math.max(viewportSize.height - padding, 1);
  const scale = Math.min(innerW / viewBox.w, innerH / viewBox.h, 1);
  return {
    scale,
    pan: {
      x: (viewportSize.width - viewBox.w * scale) / 2,
      y: (viewportSize.height - viewBox.h * scale) / 2,
    },
  };
}

export function combatMapArtboardRect(svg: string, viewBox: SvgViewBox): ArtboardRect {
  const bounds = boundingBoxElement(svg);
  if (bounds) {
    return {
      x: Number(bounds.attrs.x ?? 0),
      y: Number(bounds.attrs.y ?? 0),
      w: Number(bounds.attrs.width ?? viewBox.w),
      h: Number(bounds.attrs.height ?? viewBox.h),
    };
  }
  return { x: viewBox.x, y: viewBox.y, w: viewBox.w, h: viewBox.h };
}

/** Fit a map frame (bounding box size) into the viewport. */
export function fitMapFrameToViewport(
  frame: { w: number; h: number },
  viewportSize: { width: number; height: number },
  insets: ViewportInsets = { top: 24, right: 24, bottom: 24, left: 24 },
  maxScale = 1,
): { pan: MapViewportPan; scale: number } {
  const availW = Math.max(viewportSize.width - insets.left - insets.right, 1);
  const availH = Math.max(viewportSize.height - insets.top - insets.bottom, 1);
  const scale = Math.min(availW / frame.w, availH / frame.h, maxScale);
  return {
    scale,
    pan: {
      x: insets.left + (availW - frame.w * scale) / 2,
      y: insets.top + (availH - frame.h * scale) / 2,
    },
  };
}

/** Fit the map artboard into the viewport, honoring floating UI insets. */
export function fitCombatMapArtboard(
  artboard: ArtboardRect,
  viewportSize: { width: number; height: number },
  insets: ViewportInsets = { top: 24, right: 24, bottom: 24, left: 24 },
  maxScale = 4,
): { pan: MapViewportPan; scale: number } {
  const availW = Math.max(viewportSize.width - insets.left - insets.right, 1);
  const availH = Math.max(viewportSize.height - insets.top - insets.bottom, 1);
  const scale = Math.min(availW / artboard.w, availH / artboard.h, maxScale);
  return {
    scale,
    pan: {
      x: insets.left + (availW - artboard.w * scale) / 2 - artboard.x * scale,
      y: insets.top + (availH - artboard.h * scale) / 2 - artboard.y * scale,
    },
  };
}

/** Screen-space rulers pinned to the viewport when grid mode is on. */
export const COMBAT_MAP_VIEWPORT_RULER_TOP_H = 20;
export const COMBAT_MAP_VIEWPORT_RULER_LEFT_W = 28;

/** Map SVG user point → screen px inside the combat map viewport. */
export function mapSvgToScreen(
  svgX: number,
  svgY: number,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
): { x: number; y: number } {
  return {
    x: pan.x + (svgX - viewBox.x) * scale,
    y: pan.y + (svgY - viewBox.y) * scale,
  };
}

/** Visible map extent from viewport pan/zoom (optionally inset for ruler chrome). */
export function visibleMapSvgRect(
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
  viewportSize: { width: number; height: number },
  insets: ViewportInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): MapSvgRect {
  const s = Math.max(scale, 1e-9);
  return {
    minX: viewBox.x + (insets.left - pan.x) / s,
    maxX: viewBox.x + (viewportSize.width - pan.x) / s,
    minY: viewBox.y + (insets.top - pan.y) / s,
    maxY: viewBox.y + (viewportSize.height - pan.y) / s,
  };
}

/** Hairline chrome drawn in screen space (selection, rulers, draw preview). */
export const COMBAT_MAP_SCREEN_STROKE_PX = 1;

export type SnapGuideAxis = { axis: "x" | "y"; value: number };

/** Snap alignment guide spanning the viewport in screen px. */
export function combatMapSnapGuideScreenSegment(
  guide: SnapGuideAxis,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
  viewportSize: { width: number; height: number },
): { x1: number; y1: number; x2: number; y2: number } {
  if (guide.axis === "x") {
    const x = mapSvgToScreen(guide.value, viewBox.y, viewBox, pan, scale).x;
    return { x1: x, y1: 0, x2: x, y2: viewportSize.height };
  }
  const y = mapSvgToScreen(viewBox.x, guide.value, viewBox, pan, scale).y;
  return { x1: 0, y1: y, x2: viewportSize.width, y2: y };
}

/** Scale/vertex handle edge length in screen px, converted to map units. */
export const COMBAT_MAP_HANDLE_SCREEN_PX = 4;
/** Outer radius of the corner rotate ring (screen px), Figma-style. */
export const COMBAT_MAP_ROTATE_ZONE_OUTER_PX = 20;

export function combatMapHandleSizeMapUnits(
  _viewportSize: { width: number; height: number },
  scale: number,
): number {
  if (!Number.isFinite(scale) || scale <= 0) return COMBAT_MAP_HANDLE_SCREEN_PX;
  return COMBAT_MAP_HANDLE_SCREEN_PX / scale;
}

/** Fixed-size scale/vertex handle rect in viewport px. */
export function combatMapScreenHandleRect(
  svgX: number,
  svgY: number,
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
  sizePx = COMBAT_MAP_HANDLE_SCREEN_PX,
): ScreenRect {
  const center = mapSvgToScreen(svgX, svgY, viewBox, pan, scale);
  return {
    x: center.x - sizePx / 2,
    y: center.y - sizePx / 2,
    width: sizePx,
    height: sizePx,
  };
}

export type ScreenRect = { x: number; y: number; width: number; height: number };

/** Map bounds → screen px rect for viewport-fixed selection chrome. */
export function combatMapBoundsToScreenRect(
  bounds: { x: number; y: number; width: number; height: number },
  viewBox: SvgViewBox,
  pan: MapViewportPan,
  scale: number,
): ScreenRect {
  const topLeft = mapSvgToScreen(bounds.x, bounds.y, viewBox, pan, scale);
  const bottomRight = mapSvgToScreen(
    bounds.x + bounds.width,
    bounds.y + bounds.height,
    viewBox,
    pan,
    scale,
  );
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

/** Editor zoom readout: scale 1 = 100%. */
export function formatCombatMapZoomPercent(scale: number): string {
  const pct = scale * 100;
  if (!Number.isFinite(pct) || pct <= 0) return "—";
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}
