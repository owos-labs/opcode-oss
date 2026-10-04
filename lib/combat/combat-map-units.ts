import { mapBoundsSizeFromSvg } from "./combat-map-document.ts";
import { parseSvgViewBox } from "./combat-test-scene.ts";

/** Artboard width in meters when `meters-per-unit` is omitted (see compile-svg-map). */
export const COMBAT_MAP_DEFAULT_WIDTH_METERS = 100;

export function readSvgMetersPerUnit(svg: string): number | null {
  const m = /\bmeters-per-unit="([\d.eE+-]+)"/i.exec(svg);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function writeSvgMetersPerUnit(svg: string, metersPerUnit: number): string {
  const value = String(metersPerUnit);
  if (/\bmeters-per-unit="/i.test(svg)) {
    return svg.replace(/\bmeters-per-unit="[^"]*"/i, `meters-per-unit="${value}"`);
  }
  return svg.replace(/<svg\b/i, `<svg meters-per-unit="${value}"`);
}

function inferCombatMapMetersPerUnit(
  svg: string,
  widthMeters = COMBAT_MAP_DEFAULT_WIDTH_METERS,
): number {
  const viewBox = parseSvgViewBox(svg);
  if (viewBox && viewBox.w > 0) return widthMeters / viewBox.w;
  const bounds = mapBoundsSizeFromSvg(svg);
  if (bounds && bounds.width > 0) return widthMeters / bounds.width;
  return widthMeters / 1000;
}

/** Fixed scale from svg `meters-per-unit` (map boundary width is not the reference). */
export function combatMapMetersPerUnit(
  svg: string,
  widthMeters = COMBAT_MAP_DEFAULT_WIDTH_METERS,
): number {
  return readSvgMetersPerUnit(svg) ?? inferCombatMapMetersPerUnit(svg, widthMeters);
}

export function ensureCombatMapMetersPerUnit(
  svg: string,
  widthMeters = COMBAT_MAP_DEFAULT_WIDTH_METERS,
): string {
  if (readSvgMetersPerUnit(svg) !== null) return svg;
  return writeSvgMetersPerUnit(svg, inferCombatMapMetersPerUnit(svg, widthMeters));
}

export function svgUnitsToMeters(units: number, metersPerUnit: number): number {
  return units * metersPerUnit;
}

export function metersToSvgUnits(meters: number, metersPerUnit: number): number {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) return meters;
  return meters / metersPerUnit;
}

export function formatMapMeters(meters: number): string {
  return String(Math.round(meters * 10) / 10);
}

export function formatMapDimensionsLabel(
  widthSvg: number,
  heightSvg: number,
  metersPerUnit: number,
): string {
  const w = formatMapMeters(svgUnitsToMeters(widthSvg, metersPerUnit));
  const h = formatMapMeters(svgUnitsToMeters(heightSvg, metersPerUnit));
  return `${w}×${h}米`;
}

export function svgLengthToMeterField(
  svgUnits: string | undefined,
  metersPerUnit: number,
): string {
  const n = Number(svgUnits);
  if (!Number.isFinite(n)) return "";
  return formatMapMeters(svgUnitsToMeters(n, metersPerUnit));
}

export function meterFieldToSvgLength(
  meters: string,
  metersPerUnit: number,
): string | null {
  const n = Number(meters);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.round(metersToSvgUnits(n, metersPerUnit) * 10) / 10);
}

export function mapSizeLabelMeters(svg: string): string {
  const size = mapBoundsSizeFromSvg(svg);
  if (!size) return "—";
  const mpu = combatMapMetersPerUnit(svg);
  const w = formatMapMeters(svgUnitsToMeters(size.width, mpu));
  const h = formatMapMeters(svgUnitsToMeters(size.height, mpu));
  return `${w}×${h} m`;
}
