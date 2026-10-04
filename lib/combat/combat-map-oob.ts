import type { MapArtboard } from "./combat-map-bounds-clamp.ts";
import type { CombatMapElement } from "./combat-map-document.ts";
import { combatMapElementBounds } from "./combat-map-element-geometry.ts";

export const COMBAT_MAP_OOB_DIM_OPACITY = 0.42;
export const COMBAT_MAP_ARTBOARD_CLIP_ID = "combat-map-artboard-clip";
export const COMBAT_MAP_OOB_OUTSIDE_CLIP_ID = "combat-map-oob-outside-clip";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Even-odd path: artboard exterior only (for dimmed OOB ghost overlay). */
export function combatMapOutsideArtboardClipPathD(
  artboard: MapArtboard,
  pad = 5000,
): string {
  const ox = artboard.x - pad;
  const oy = artboard.y - pad;
  const ow = artboard.w + pad * 2;
  const oh = artboard.h + pad * 2;
  const { x: ax, y: ay, w: aw, h: ah } = artboard;
  return `M ${ox} ${oy} h ${ow} v ${oh} h ${-ow} Z M ${ax} ${ay} h ${aw} v ${ah} h ${-aw} Z`;
}

function attachInsideClipPathToNamedElement(markup: string, name: string): string {
  const re = new RegExp(
    `(<(?:rect|path|circle)\\b(?=[^>]*\\bname="${escapeRegExp(name)}")[^>]*)(\\/?>)`,
    "i",
  );
  return markup.replace(re, (full, open: string, close: string) => {
    if (/clip-path="/i.test(open)) return full;
    return `${open} clip-path="url(#${COMBAT_MAP_ARTBOARD_CLIP_ID})"${close}`;
  });
}

/** Clip OOB shapes to the artboard in the main svg; outside portions render via ghost overlay only. */
export function applyCombatMapOobInsideClip(
  markup: string,
  artboard: MapArtboard,
  oobElementIds: readonly string[],
): string {
  if (!/<svg[\s>]/i.test(markup)) return markup;
  const clipDef = `<defs><clipPath id="${COMBAT_MAP_ARTBOARD_CLIP_ID}" clipPathUnits="userSpaceOnUse"><rect x="${artboard.x}" y="${artboard.y}" width="${artboard.w}" height="${artboard.h}"/></clipPath></defs>`;
  let next = markup.replace(/<svg([^>]*)>/i, (_, attrs: string) => `<svg${attrs}>${clipDef}`);
  for (const id of oobElementIds) {
    next = attachInsideClipPathToNamedElement(next, id);
  }
  return next;
}

export function elementOutsideArtboard(el: CombatMapElement, artboard: MapArtboard): boolean {
  if (el.kind === "bounding_box") return false;
  const bounds = combatMapElementBounds(el);
  if (!bounds) return false;
  return (
    bounds.x < artboard.x - 1e-6 ||
    bounds.y < artboard.y - 1e-6 ||
    bounds.x + bounds.width > artboard.x + artboard.w + 1e-6 ||
    bounds.y + bounds.height > artboard.y + artboard.h + 1e-6
  );
}

export function oobHoverLabelAnchor(
  el: CombatMapElement,
  artboard: MapArtboard,
): { x: number; y: number } | null {
  const bounds = combatMapElementBounds(el);
  if (!bounds || !elementOutsideArtboard(el, artboard)) return null;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const insideX = cx >= artboard.x && cx <= artboard.x + artboard.w;
  const insideY = cy >= artboard.y && cy <= artboard.y + artboard.h;
  if (!insideX || !insideY) return { x: cx, y: cy };
  const distLeft = cx - artboard.x;
  const distRight = artboard.x + artboard.w - cx;
  const distTop = cy - artboard.y;
  const distBottom = artboard.y + artboard.h - cy;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) return { x: artboard.x - 8, y: cy };
  if (min === distRight) return { x: artboard.x + artboard.w + 8, y: cy };
  if (min === distTop) return { x: cx, y: artboard.y - 8 };
  return { x: cx, y: artboard.y + artboard.h + 8 };
}

export type OobGhostShape =
  | {
      tag: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      stroke?: string;
      strokeWidth?: string;
      transform?: string;
      fillOpacity?: string;
    }
  | {
      tag: "circle";
      cx: number;
      cy: number;
      r: number;
      fill: string;
      stroke?: string;
      strokeWidth?: string;
    }
  | {
      tag: "path";
      d: string;
      fill: string;
      stroke?: string;
      strokeWidth?: string;
    };

export function hitOutOfBoundsElementAtPoint(
  elements: readonly CombatMapElement[],
  pt: { x: number; y: number },
  artboard: MapArtboard,
): CombatMapElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (!elementOutsideArtboard(el, artboard)) continue;
    const bounds = combatMapElementBounds(el);
    if (!bounds) continue;
    if (
      pt.x >= bounds.x &&
      pt.x <= bounds.x + bounds.width &&
      pt.y >= bounds.y &&
      pt.y <= bounds.y + bounds.height
    ) {
      return el;
    }
  }
  return null;
}

export function combatMapOobGhostShape(el: CombatMapElement): OobGhostShape | null {
  if (el.tag === "rect") {
    const x = Number(el.attrs.x ?? 0);
    const y = Number(el.attrs.y ?? 0);
    const width = Number(el.attrs.width ?? 0);
    const height = Number(el.attrs.height ?? 0);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return {
      tag: "rect",
      x,
      y,
      width,
      height,
      fill: el.attrs.fill ?? "#c8c8c8",
      stroke: el.attrs.stroke,
      strokeWidth: el.attrs["stroke-width"],
      transform: el.attrs.transform,
      fillOpacity: el.attrs["fill-opacity"],
    };
  }
  if (el.tag === "circle") {
    const cx = Number(el.attrs.cx);
    const cy = Number(el.attrs.cy);
    const r = Number(el.attrs.r ?? 14);
    if (![cx, cy, r].every(Number.isFinite)) return null;
    return {
      tag: "circle",
      cx,
      cy,
      r,
      fill: el.attrs.fill ?? "#2563eb",
      stroke: el.attrs.stroke,
      strokeWidth: el.attrs["stroke-width"],
    };
  }
  if (el.tag === "path" && el.attrs.d) {
    return {
      tag: "path",
      d: el.attrs.d,
      fill: el.attrs.fill ?? "#b0b0b0",
      stroke: el.attrs.stroke,
      strokeWidth: el.attrs["stroke-width"],
    };
  }
  return null;
}
