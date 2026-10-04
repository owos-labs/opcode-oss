import { formatMapMeters, svgUnitsToMeters } from "./combat-map-units.ts";
import type { ArtboardRect, MapSvgRect } from "./combat-map-viewport.ts";

const TICK_STEPS_M = [0.5, 1, 2, 5, 10, 20, 25, 50, 100];

/** Grid overlay spacing when grid mode is on. */
export const COMBAT_MAP_GRID_STEP_METERS = 1;
export const COMBAT_MAP_GRID_MAJOR_EVERY_METERS = 10;
export const COMBAT_MAP_GRID_SCALE_0_5_M = 3;
export const COMBAT_MAP_GRID_SCALE_0_1_M = 5;
const GRID_STEPS_ZOOMED_OUT_M = [1, 2, 5, 10, 20, 50, 100] as const;

export type RulerMark = {
  axis: "x" | "y";
  svg: number;
  label: string | null;
  major: boolean;
};

export type GridLine = {
  axis: "x" | "y";
  svg: number;
  major: boolean;
};

/** Pick a round meter step so labels stay ~minLabelSpacingPx apart on screen. */
export function pickRulerTickStepMeters(
  scale: number,
  metersPerUnit: number,
  minLabelSpacingPx = 56,
): number {
  const raw = minLabelSpacingPx * (metersPerUnit / Math.max(scale, 1e-9));
  for (const step of TICK_STEPS_M) {
    if (step >= raw) return step;
  }
  return TICK_STEPS_M[TICK_STEPS_M.length - 1]!;
}

/** Grid minor spacing from editor zoom (scale = viewport px per SVG unit). */
export function pickCombatMapGridStepMeters(
  scale: number,
  metersPerUnit: number,
  minLineSpacingPx = 32,
): number {
  if (scale >= COMBAT_MAP_GRID_SCALE_0_1_M) return 0.1;
  if (scale >= COMBAT_MAP_GRID_SCALE_0_5_M) return 0.5;
  const raw = minLineSpacingPx * (metersPerUnit / Math.max(scale, 1e-9));
  for (const step of GRID_STEPS_ZOOMED_OUT_M) {
    if (step >= raw) return step;
  }
  return GRID_STEPS_ZOOMED_OUT_M[GRID_STEPS_ZOOMED_OUT_M.length - 1]!;
}

/** Major grid emphasis interval in meters (1 m when minors are sub-meter). */
export function combatMapGridMajorIntervalM(minorStepM: number): number {
  return minorStepM >= 1 ? COMBAT_MAP_GRID_MAJOR_EVERY_METERS : 1;
}

export function isMajorGridMeter(meters: number, minorStepM: number): boolean {
  const majorIntervalM = combatMapGridMajorIntervalM(minorStepM);
  const ratio = meters / majorIntervalM;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

export function formatRulerLabel(meters: number): string {
  return `${formatMapMeters(meters)}m`;
}

export function rulerChromeMapUnits(scale: number): {
  majorTick: number;
  minorTick: number;
  fontSize: number;
  stroke: number;
  labelPad: number;
} {
  const s = Math.max(scale, 1e-9);
  return {
    majorTick: 7 / s,
    minorTick: 4 / s,
    fontSize: 11 / s,
    stroke: 1 / s,
    labelPad: 3 / s,
  };
}

function isMajorTick(meters: number, majorStepM: number): boolean {
  const ratio = meters / majorStepM;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

export function buildCombatMapRulerMarks(
  artboard: ArtboardRect,
  metersPerUnit: number,
  majorStepM: number,
): RulerMark[] {
  const widthM = svgUnitsToMeters(artboard.w, metersPerUnit);
  const heightM = svgUnitsToMeters(artboard.h, metersPerUnit);
  const minorStepM = majorStepM / 2;
  const marks: RulerMark[] = [];

  function pushAxis(axis: "x" | "y", lengthM: number, originSvg: number) {
    const seen = new Set<number>();
    for (let m = 0; m <= lengthM + 1e-9; m += minorStepM) {
      const rounded = Math.round(m * 100) / 100;
      if (seen.has(rounded)) continue;
      seen.add(rounded);
      const major = isMajorTick(rounded, majorStepM);
      marks.push({
        axis,
        svg: originSvg + m / metersPerUnit,
        label: major ? formatRulerLabel(rounded) : null,
        major,
      });
    }
  }

  pushAxis("x", widthM, artboard.x);
  pushAxis("y", heightM, artboard.y);
  return marks;
}

export function buildCombatMapRulerMarksInRange(
  artboard: ArtboardRect,
  metersPerUnit: number,
  majorStepM: number,
  range: MapSvgRect,
): RulerMark[] {
  const pad = 0.5 / Math.max(metersPerUnit, 1e-9);
  return buildCombatMapRulerMarks(artboard, metersPerUnit, majorStepM).filter((mark) => {
    if (mark.axis === "x") {
      return mark.svg >= range.minX - pad && mark.svg <= range.maxX + pad;
    }
    return mark.svg >= range.minY - pad && mark.svg <= range.maxY + pad;
  });
}

export function combatMapGridStepSvg(
  metersPerUnit: number,
  stepM = COMBAT_MAP_GRID_STEP_METERS,
): number {
  return stepM / metersPerUnit;
}

/** One repeating tile: 1 m minors inside a 10 m major cell (for SVG pattern fill). */
export function buildCombatMapGridPatternPath(
  minorStepSvg: number,
  majorStepSvg: number,
): string {
  const parts: string[] = [];
  for (let x = minorStepSvg; x < majorStepSvg - 1e-9; x += minorStepSvg) {
    parts.push(`M ${x} 0 V ${majorStepSvg}`);
  }
  for (let y = minorStepSvg; y < majorStepSvg - 1e-9; y += minorStepSvg) {
    parts.push(`M 0 ${y} H ${majorStepSvg}`);
  }
  parts.push(`M ${majorStepSvg} 0 L 0 0 0 ${majorStepSvg}`);
  return parts.join(" ");
}

/** @deprecated Prefer SVG pattern; kept for tests and tooling. */
export function buildCombatMapGridLines(
  artboard: ArtboardRect,
  metersPerUnit: number,
  stepM = COMBAT_MAP_GRID_STEP_METERS,
): GridLine[] {
  const widthM = svgUnitsToMeters(artboard.w, metersPerUnit);
  const heightM = svgUnitsToMeters(artboard.h, metersPerUnit);
  const lines: GridLine[] = [];

  function pushAxis(axis: "x" | "y", lengthM: number, originSvg: number) {
    for (let m = 0; m <= lengthM + 1e-9; m += stepM) {
      const rounded = Math.round(m * 1000) / 1000;
      lines.push({
        axis,
        svg: originSvg + m / metersPerUnit,
        major: isMajorGridMeter(rounded, stepM),
      });
    }
  }

  pushAxis("x", widthM, artboard.x);
  pushAxis("y", heightM, artboard.y);
  return lines;
}

export function buildCombatMapGridLinesInRange(
  artboard: ArtboardRect,
  metersPerUnit: number,
  range: MapSvgRect,
  stepM = COMBAT_MAP_GRID_STEP_METERS,
): GridLine[] {
  return buildCombatMapGridLines(artboard, metersPerUnit, stepM).filter((line) => {
    if (line.axis === "x") {
      return line.svg >= range.minX - 1e-9 && line.svg <= range.maxX + 1e-9;
    }
    return line.svg >= range.minY - 1e-9 && line.svg <= range.maxY + 1e-9;
  });
}

/** Clip a grid line to the artboard ∩ visible map range (map units). */
export function clipCombatMapGridLineSegment(
  line: GridLine,
  artboard: ArtboardRect,
  range: MapSvgRect,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const minX = Math.max(artboard.x, range.minX);
  const maxX = Math.min(artboard.x + artboard.w, range.maxX);
  const minY = Math.max(artboard.y, range.minY);
  const maxY = Math.min(artboard.y + artboard.h, range.maxY);
  if (minX > maxX || minY > maxY) return null;
  if (line.axis === "x") {
    if (line.svg < artboard.x - 1e-9 || line.svg > artboard.x + artboard.w + 1e-9) return null;
    return { x1: line.svg, y1: minY, x2: line.svg, y2: maxY };
  }
  if (line.svg < artboard.y - 1e-9 || line.svg > artboard.y + artboard.h + 1e-9) return null;
  return { x1: minX, y1: line.svg, x2: maxX, y2: line.svg };
}
