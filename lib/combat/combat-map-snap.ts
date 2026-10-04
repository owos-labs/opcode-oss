import { mapArtboardFromAttrs } from "./combat-map-bounds-clamp.ts";
import { boundingBoxElement, parseCombatMapElements } from "./combat-map-document.ts";
import { combatMapElementBounds, type ElementBounds } from "./combat-map-element-geometry.ts";
import { COMBAT_MAP_GRID_STEP_METERS } from "./combat-map-ruler.ts";
import { svgUnitsToMeters } from "./combat-map-units.ts";
import type { ArtboardRect } from "./combat-map-viewport.ts";

export type SnapGuide = { axis: "x" | "y"; value: number };
export type SnapTargets = { xs: number[]; ys: number[] };

export const COMBAT_MAP_SNAP_SCREEN_PX = 8;

export function snapThresholdMapUnits(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return COMBAT_MAP_SNAP_SCREEN_PX;
  return COMBAT_MAP_SNAP_SCREEN_PX / scale;
}

function boundsKeypoints(bounds: ElementBounds): { xs: number[]; ys: number[] } {
  return {
    xs: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
    ys: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
  };
}

export function collectCombatMapSnapTargets(
  svg: string,
  excludeIds?: string | readonly string[],
): SnapTargets {
  const exclude = new Set(
    excludeIds === undefined ? [] : Array.isArray(excludeIds) ? excludeIds : [excludeIds],
  );
  const xs: number[] = [];
  const ys: number[] = [];

  const bounds = boundingBoxElement(svg);
  if (bounds) {
    const artboard = mapArtboardFromAttrs(bounds.attrs);
    xs.push(artboard.x, artboard.x + artboard.w / 2, artboard.x + artboard.w);
    ys.push(artboard.y, artboard.y + artboard.h / 2, artboard.y + artboard.h);
  }

  for (const el of parseCombatMapElements(svg)) {
    if (exclude.has(el.id) || el.kind === "bounding_box") continue;
    const box = combatMapElementBounds(el);
    if (!box) continue;
    xs.push(box.x, box.x + box.width / 2, box.x + box.width);
    ys.push(box.y, box.y + box.height / 2, box.y + box.height);
  }

  return { xs, ys };
}

export function collectCombatMapGridSnapTargets(
  artboard: ArtboardRect,
  metersPerUnit: number,
  stepM = COMBAT_MAP_GRID_STEP_METERS,
): SnapTargets {
  const widthM = svgUnitsToMeters(artboard.w, metersPerUnit);
  const heightM = svgUnitsToMeters(artboard.h, metersPerUnit);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let m = 0; m <= widthM + 1e-9; m += stepM) {
    xs.push(artboard.x + m / metersPerUnit);
  }
  for (let m = 0; m <= heightM + 1e-9; m += stepM) {
    ys.push(artboard.y + m / metersPerUnit);
  }
  return { xs, ys };
}

export function mergeSnapTargets(...targets: readonly SnapTargets[]): SnapTargets {
  return {
    xs: [...new Set(targets.flatMap((t) => t.xs))],
    ys: [...new Set(targets.flatMap((t) => t.ys))],
  };
}

export type MeterGridSnap = {
  originX: number;
  originY: number;
  stepSvg: number;
};

export function meterGridSnapFromArtboard(
  artboard: ArtboardRect,
  metersPerUnit: number,
  stepM = COMBAT_MAP_GRID_STEP_METERS,
): MeterGridSnap {
  return {
    originX: artboard.x,
    originY: artboard.y,
    stepSvg: stepM / metersPerUnit,
  };
}

export function snapValueToGrid(
  value: number,
  origin: number,
  stepSvg: number,
  threshold: number,
): { value: number; guide: number | null } {
  if (!Number.isFinite(stepSvg) || stepSvg <= 0) return { value, guide: null };
  const nearest = origin + Math.round((value - origin) / stepSvg) * stepSvg;
  const dist = Math.abs(nearest - value);
  if (dist <= threshold) return { value: nearest, guide: nearest };
  return { value, guide: null };
}

function pickCloserSnap(
  value: number,
  targets: readonly number[],
  threshold: number,
  gridOrigin: number,
  gridStepSvg: number,
  gridEnabled: boolean,
): { value: number; guide: number | null } {
  const fromTargets = snapValue(value, targets, threshold);
  if (!gridEnabled) return fromTargets;
  const fromGrid = snapValueToGrid(value, gridOrigin, gridStepSvg, threshold);
  const targetDist =
    fromTargets.guide === null ? Number.POSITIVE_INFINITY : Math.abs(fromTargets.guide - value);
  const gridDist =
    fromGrid.guide === null ? Number.POSITIVE_INFINITY : Math.abs(fromGrid.guide - value);
  return gridDist <= targetDist ? fromGrid : fromTargets;
}

export function snapValue(
  value: number,
  targets: readonly number[],
  threshold: number,
): { value: number; guide: number | null } {
  let guide: number | null = null;
  let best = threshold + 1;
  for (const target of targets) {
    const dist = Math.abs(target - value);
    if (dist <= threshold && dist < best) {
      best = dist;
      guide = target;
    }
  }
  return guide === null ? { value, guide: null } : { value: guide, guide };
}

export function snapPoint(
  x: number,
  y: number,
  targets: SnapTargets,
  threshold: number,
  grid?: MeterGridSnap | null,
): { x: number; y: number; guides: SnapGuide[] } {
  const snappedX = pickCloserSnap(
    x,
    targets.xs,
    threshold,
    grid?.originX ?? 0,
    grid?.stepSvg ?? 0,
    grid != null,
  );
  const snappedY = pickCloserSnap(
    y,
    targets.ys,
    threshold,
    grid?.originY ?? 0,
    grid?.stepSvg ?? 0,
    grid != null,
  );
  const guides: SnapGuide[] = [];
  if (snappedX.guide !== null) guides.push({ axis: "x", value: snappedX.guide });
  if (snappedY.guide !== null) guides.push({ axis: "y", value: snappedY.guide });
  return { x: snappedX.value, y: snappedY.value, guides };
}

export function snapRectBounds(
  bounds: ElementBounds,
  targets: SnapTargets,
  threshold: number,
  grid?: MeterGridSnap | null,
): { bounds: ElementBounds; guides: SnapGuide[] } {
  const keys = boundsKeypoints(bounds);
  let dx = 0;
  let dy = 0;
  let guideX: number | null = null;
  let guideY: number | null = null;
  let bestX = threshold + 1;
  let bestY = threshold + 1;

  for (const x of keys.xs) {
    for (const target of targets.xs) {
      const delta = target - x;
      const dist = Math.abs(delta);
      if (dist <= threshold && dist < bestX) {
        bestX = dist;
        dx = delta;
        guideX = target;
      }
    }
    if (grid) {
      const snapped = snapValueToGrid(x, grid.originX, grid.stepSvg, threshold);
      if (snapped.guide !== null) {
        const delta = snapped.guide - x;
        const dist = Math.abs(delta);
        if (dist <= threshold && dist < bestX) {
          bestX = dist;
          dx = delta;
          guideX = snapped.guide;
        }
      }
    }
  }

  for (const y of keys.ys) {
    for (const target of targets.ys) {
      const delta = target - y;
      const dist = Math.abs(delta);
      if (dist <= threshold && dist < bestY) {
        bestY = dist;
        dy = delta;
        guideY = target;
      }
    }
    if (grid) {
      const snapped = snapValueToGrid(y, grid.originY, grid.stepSvg, threshold);
      if (snapped.guide !== null) {
        const delta = snapped.guide - y;
        const dist = Math.abs(delta);
        if (dist <= threshold && dist < bestY) {
          bestY = dist;
          dy = delta;
          guideY = snapped.guide;
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (guideX !== null) guides.push({ axis: "x", value: guideX });
  if (guideY !== null) guides.push({ axis: "y", value: guideY });

  return {
    bounds: { ...bounds, x: bounds.x + dx, y: bounds.y + dy },
    guides,
  };
}

export function snapMoveDelta(
  originBounds: ElementBounds,
  dx: number,
  dy: number,
  targets: SnapTargets,
  threshold: number,
  grid?: MeterGridSnap | null,
): { dx: number; dy: number; guides: SnapGuide[] } {
  const candidate = {
    ...originBounds,
    x: originBounds.x + dx,
    y: originBounds.y + dy,
  };
  const snapped = snapRectBounds(candidate, targets, threshold, grid);
  return {
    dx: snapped.bounds.x - originBounds.x,
    dy: snapped.bounds.y - originBounds.y,
    guides: snapped.guides,
  };
}

/** Snap only the dragged corner to element edges; skip meter grid so thin walls stay drawable. */
export function snapDrawRectFromAnchor(
  anchor: { x: number; y: number },
  corner: { x: number; y: number },
  targets: SnapTargets,
  threshold: number,
): { bounds: ElementBounds; corner: { x: number; y: number }; guides: SnapGuide[] } {
  const snappedCorner = snapPoint(corner.x, corner.y, targets, threshold, null);
  const bounds = {
    x: Math.min(anchor.x, snappedCorner.x),
    y: Math.min(anchor.y, snappedCorner.y),
    width: Math.abs(snappedCorner.x - anchor.x),
    height: Math.abs(snappedCorner.y - anchor.y),
  };
  return {
    bounds,
    corner: { x: snappedCorner.x, y: snappedCorner.y },
    guides: snappedCorner.guides,
  };
}
