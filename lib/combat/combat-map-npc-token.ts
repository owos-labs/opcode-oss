import { metersToSvgUnits, svgUnitsToMeters } from "./combat-map-units.ts";

/** Default NPC token footprint on the map (meters). */
export const COMBAT_MAP_NPC_TOKEN_DIAMETER_M = 0.5;

export function defaultNpcTokenRadiusSvg(metersPerUnit: number): number {
  return metersToSvgUnits(COMBAT_MAP_NPC_TOKEN_DIAMETER_M / 2, metersPerUnit);
}

export function npcTokenDiameterMFromAttrs(
  attrs: Record<string, string>,
  metersPerUnit: number,
): number {
  const r = Number(attrs.r ?? defaultNpcTokenRadiusSvg(metersPerUnit));
  if (!Number.isFinite(r) || r <= 0) return COMBAT_MAP_NPC_TOKEN_DIAMETER_M;
  return svgUnitsToMeters(r * 2, metersPerUnit);
}

export function patchNpcTokenRadiusFromDiameterM(
  diameterM: string,
  metersPerUnit: number,
): string | null {
  const d = Number(diameterM);
  if (!Number.isFinite(d) || d <= 0) return null;
  return String(Math.round(metersToSvgUnits(d / 2, metersPerUnit) * 10) / 10);
}

/** Play mode: tap an NPC token to inspect, tap empty map to clear. */
export function resolvePlayModeTapSelection(
  moved: boolean,
  tapSelectId: string | undefined,
): string[] | null {
  if (moved) return null;
  return tapSelectId ? [tapSelectId] : [];
}
