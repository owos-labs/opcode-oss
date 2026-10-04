import type { CombatMapElement } from "./combat-map-document.ts";
import type { ElementBounds } from "./combat-map-element-geometry.ts";
import { formatMapDimensionsLabel } from "./combat-map-units.ts";
import {
  rectElementRotation,
  rectLocalBounds,
  rectRotationCenter,
} from "./combat-map-rotate.ts";
import { COMBAT_MAP_COVER_LABEL_MIN_SCALE } from "./combat-map-cover-labels.ts";

export type RoomLabelChrome = {
  id: string;
  localBounds: ElementBounds;
  rotationDeg: number;
  pivot: { x: number; y: number };
  name: string;
  sizeLabel: string;
};

export function shouldShowRoomLabels(scale: number): boolean {
  return scale >= COMBAT_MAP_COVER_LABEL_MIN_SCALE;
}

export function formatRoomDimensionsLabel(
  widthSvg: number,
  heightSvg: number,
  metersPerUnit: number,
): string {
  return formatMapDimensionsLabel(widthSvg, heightSvg, metersPerUnit);
}

export function roomLabelTransform(chrome: RoomLabelChrome): string | undefined {
  if (Math.abs(chrome.rotationDeg) < 0.5) return undefined;
  return `rotate(${chrome.rotationDeg} ${chrome.pivot.x} ${chrome.pivot.y})`;
}

export function roomLabelChrome(
  el: CombatMapElement,
  metersPerUnit: number,
): RoomLabelChrome | null {
  if (el.kind !== "room" || el.tag !== "rect") return null;
  const bounds = rectLocalBounds(el);
  if (!bounds) return null;
  const rotation = rectElementRotation(el);
  const pivot = rectRotationCenter(bounds, rotation);
  const name = el.attrs.name?.trim() || el.id;
  return {
    id: el.id,
    localBounds: bounds,
    rotationDeg: rotation?.deg ?? 0,
    pivot: { x: pivot.cx, y: pivot.cy },
    name,
    sizeLabel: formatRoomDimensionsLabel(bounds.width, bounds.height, metersPerUnit),
  };
}

export function collectRoomLabels(
  elements: readonly CombatMapElement[],
  metersPerUnit: number,
): RoomLabelChrome[] {
  return elements
    .map((el) => roomLabelChrome(el, metersPerUnit))
    .filter((entry): entry is RoomLabelChrome => Boolean(entry));
}
