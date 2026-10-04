import type { CombatMapElement } from "./combat-map-document.ts";
import {
  combatMapElementBounds,
  type ElementBounds,
} from "./combat-map-element-geometry.ts";
import { COMBAT_MAP_GRID_SCALE_0_5_M } from "./combat-map-ruler.ts";
import {
  rectElementRotation,
  rectLocalBounds,
  rectRotationCenter,
} from "./combat-map-rotate.ts";
import { formatMapDimensionsLabel } from "./combat-map-units.ts";

export const COMBAT_MAP_COVER_LABEL_MIN_SCALE = COMBAT_MAP_GRID_SCALE_0_5_M;
export const COMBAT_MAP_COVER_LABEL_SCREEN_PX = 10;
export const COMBAT_MAP_COVER_LABEL_PAD_SCREEN_PX = 6;

export type ConcealmentCoverLabelChrome = {
  id: string;
  localBounds: ElementBounds;
  rotationDeg: number;
  pivot: { x: number; y: number };
  ssp: string;
  ar: string;
  name: string;
  sizeLabel: string;
};

export function concealmentCoverLabelTransform(chrome: ConcealmentCoverLabelChrome): string | undefined {
  if (Math.abs(chrome.rotationDeg) < 0.5) return undefined;
  return `rotate(${chrome.rotationDeg} ${chrome.pivot.x} ${chrome.pivot.y})`;
}

export function shouldShowConcealmentCoverLabels(scale: number): boolean {
  return scale >= COMBAT_MAP_COVER_LABEL_MIN_SCALE;
}

export function combatMapOverlayLabelText(text: string): string {
  return text.toUpperCase();
}

/** Fit centered size label to rect; corner labels keep fixed screen px. */
export function combatMapOverlayCenterFontSize(
  bounds: ElementBounds,
  scale: number,
  text: string,
): number {
  const scaleSafe = Math.max(scale, 1e-9);
  const maxScreen = COMBAT_MAP_COVER_LABEL_SCREEN_PX / scaleSafe;
  const pad = COMBAT_MAP_COVER_LABEL_PAD_SCREEN_PX / scaleSafe;
  const innerW = Math.max(bounds.width - pad * 2, 0);
  const innerH = Math.max(bounds.height - pad * 2, 0);
  if (innerW <= 0 || innerH <= 0) return maxScreen;
  const chars = Math.max(text.length, 1);
  const fromWidth = innerW / (chars * 0.6);
  const fromHeight = innerH * 0.9;
  return Math.min(maxScreen, fromWidth, fromHeight);
}

export function concealmentCoverLabelChrome(
  el: CombatMapElement,
  metersPerUnit: number,
): ConcealmentCoverLabelChrome | null {
  if (el.kind !== "concealment") return null;
  const name = el.attrs.name?.trim() || el.id;
  const ar = el.attrs.ar?.trim() || "0";
  const ssp = el.attrs.ssp?.trim() || "0";

  if (el.tag === "rect") {
    const bounds = rectLocalBounds(el);
    if (!bounds) return null;
    const rotation = rectElementRotation(el);
    const pivot = rectRotationCenter(bounds, rotation);
    return {
      id: el.id,
      localBounds: bounds,
      rotationDeg: rotation?.deg ?? 0,
      pivot: { x: pivot.cx, y: pivot.cy },
      ar,
      ssp,
      name,
      sizeLabel: formatMapDimensionsLabel(bounds.width, bounds.height, metersPerUnit),
    };
  }

  if (el.tag === "path" && el.attrs.d) {
    const bounds = combatMapElementBounds(el);
    if (!bounds) return null;
    return {
      id: el.id,
      localBounds: bounds,
      rotationDeg: 0,
      pivot: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      ar,
      ssp,
      name,
      sizeLabel: formatMapDimensionsLabel(bounds.width, bounds.height, metersPerUnit),
    };
  }

  return null;
}

export function collectConcealmentCoverLabels(
  elements: readonly CombatMapElement[],
  metersPerUnit: number,
): ConcealmentCoverLabelChrome[] {
  return elements
    .map((el) => concealmentCoverLabelChrome(el, metersPerUnit))
    .filter((entry): entry is ConcealmentCoverLabelChrome => Boolean(entry));
}
