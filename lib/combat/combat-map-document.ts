import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import {
  normalizeCombatMapLayerGroups,
  removeLayerFromGroups,
  type CombatMapLayerGroup,
} from "./combat-map-layer-groups.ts";
import {
  clampRectToArtboard,
  mapArtboardFromAttrs,
  shouldClampMapElement,
  type MapArtboard,
} from "./combat-map-bounds-clamp.ts";
import { combatMapElementBounds, patchElementToBounds } from "./combat-map-element-geometry.ts";
import { rectElementIsRotated } from "./combat-map-rotate.ts";
import { minCombatDrawRectSizeSvg, type CombatDrawTool } from "./combat-map-editor-input.ts";
import { defaultNpcTokenRadiusSvg } from "./combat-map-npc-token.ts";
import { combatMapMetersPerUnit, mapSizeLabelMeters } from "./combat-map-units.ts";
import { setPathVertex, translatePathD } from "./combat-map-path.ts";

export type CombatMapElementKind =
  | "bounding_box"
  | "barrier"
  | "concealment"
  | "room"
  | "npc_token"
  | "unknown";

export type CombatMapElement = {
  id: string;
  kind: CombatMapElementKind;
  tag: "rect" | "path" | "circle";
  attrs: Record<string, string>;
};

export type CombatMapDocument = {
  id: string;
  title: string;
  svg: string;
  inCombat: boolean;
  updated_at: string;
  layerGroups?: CombatMapLayerGroup[];
};

export type { CombatMapLayerGroup };

const TAG_RE = /<(rect|path|circle)\b([^>]*)\/?>/gi;

function parseAttrs(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

function inferKind(attrs: Record<string, string>): CombatMapElementKind {
  const t = attrs.type;
  if (t === "bounding_box" || t === "barrier" || t === "concealment" || t === "room" || t === "npc_token") {
    return t;
  }
  if (/^#ffcc24$/i.test(attrs.fill ?? "")) return "room";
  return "unknown";
}

export function newCombatMapElementId(): string {
  return crypto.randomUUID();
}

function escapeAttr(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseCombatMapElements(svg: string): CombatMapElement[] {
  const elements: CombatMapElement[] = [];
  let index = 0;
  for (const match of svg.matchAll(TAG_RE)) {
    const tag = match[1]!.toLowerCase() as CombatMapElement["tag"];
    const attrs = parseAttrs(match[2] ?? "");
    const id = attrs.id?.trim() || attrs.name?.trim() || `${tag}-${index++}`;
    elements.push({ id, kind: inferKind(attrs), tag, attrs: { ...attrs } });
  }
  return elements;
}

export function mapBoundsSizeFromSvg(svg: string): { width: number; height: number } | null {
  const bounds = boundingBoxElement(svg);
  if (bounds) {
    const width = Number(bounds.attrs.width);
    const height = Number(bounds.attrs.height);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  return mapSizeFromSvg(svg);
}

export function mapSizeFromSvg(svg: string): { width: number; height: number } | null {
  const viewBox = /viewBox="[\d.+-]+\s+[\d.+-]+\s+([\d.+-]+)\s+([\d.+-]+)"/i.exec(svg);
  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
  }
  const w = /width="([\d.+-]+)"/i.exec(svg);
  const h = /height="([\d.+-]+)"/i.exec(svg);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  return null;
}

export function mapSizeLabel(svg: string): string {
  return mapSizeLabelMeters(svg);
}

/** Keep root svg viewBox/width/height aligned with type=bounding_box frame. */
export function syncViewBoxToBoundingBox(svg: string): string {
  const bounds = boundingBoxElement(svg);
  if (!bounds) return svg;
  const x = Number(bounds.attrs.x ?? 0);
  const y = Number(bounds.attrs.y ?? 0);
  const w = Math.max(1, Math.round(Number(bounds.attrs.width ?? 0)));
  const h = Math.max(1, Math.round(Number(bounds.attrs.height ?? 0)));
  if (![x, y, w, h].every(Number.isFinite)) return svg;
  let next = svg.replace(/viewBox="[^"]*"/i, `viewBox="${x} ${y} ${w} ${h}"`);
  next = next.replace(/\bwidth="[^"]*"/i, `width="${w}"`);
  next = next.replace(/\bheight="[^"]*"/i, `height="${h}"`);
  return next;
}

function displayNamesInUse(svg: string): Set<string> {
  const used = new Set<string>();
  for (const el of parseCombatMapElements(svg)) {
    const label = el.attrs.name?.trim();
    if (label) used.add(label);
  }
  return used;
}

export function nextElementDisplayName(svg: string, prefix: string): string {
  const used = displayNamesInUse(svg);
  let n = 0;
  while (used.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** @deprecated Use nextElementDisplayName for labels; ids are UUIDs. */
export const nextElementName = nextElementDisplayName;

function displayPrefixForKind(kind: InsertRectOptions["kind"]): string {
  if (kind === "barrier") return "wall";
  if (kind === "concealment") return "cover";
  if (kind === "room") return "room";
  return "bounds";
}

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

function replaceElementTag(svg: string, id: string, nextTag: string): string {
  const elements = parseCombatMapElements(svg);
  const idx = elements.findIndex((e) => e.id === id);
  if (idx < 0) return svg;
  const el = elements[idx]!;
  const domId = el.attrs.id?.trim();
  if (domId) {
    const re = new RegExp(`<(rect|path|circle)\\b[^>]*\\bid="${escapeAttr(domId)}"[^>]*/?>`, "i");
    return svg.replace(re, nextTag);
  }
  const name = el.attrs.name?.trim();
  if (name) {
    const re = new RegExp(`<(rect|path|circle)\\b[^>]*\\bname="${escapeAttr(name)}"[^>]*/?>`, "i");
    return svg.replace(re, nextTag);
  }
  if (el.kind === "bounding_box") {
    return svg.replace(/<rect\b[^>]*\btype="bounding_box"[^>]*\/?>/i, nextTag);
  }
  const tagRe = /<(rect|path|circle)\b[^>]*\/?>/gi;
  let n = 0;
  return svg.replace(tagRe, (match) => (n++ === idx ? nextTag : match));
}

export function updateCombatMapElement(
  svg: string,
  id: string,
  patch: Record<string, string | undefined>,
): string {
  const el = parseCombatMapElements(svg).find((e) => e.id === id);
  if (!el) return svg;
  const safePatch = { ...patch };
  if (safePatch.name !== undefined && !safePatch.name.trim()) delete safePatch.name;
  let nextAttrs = { ...el.attrs };
  for (const [key, value] of Object.entries(safePatch)) {
    if (value === undefined) delete nextAttrs[key];
    else nextAttrs[key] = value;
  }
  const tag = el.tag;
  const next = `<${tag} ${attrsToString(nextAttrs)}/>`;
  const updated = replaceElementTag(svg, id, next);
  if (el.kind === "bounding_box") return syncViewBoxToBoundingBox(updated);
  return updated;
}

export function removeCombatMapElement(svg: string, id: string): string {
  const elements = parseCombatMapElements(svg);
  const idx = elements.findIndex((e) => e.id === id);
  if (idx < 0) return svg;
  const el = elements[idx]!;
  if (!canDeleteCombatMapElement(el)) return svg;
  const domId = el.attrs.id?.trim();
  if (domId) {
    const re = new RegExp(`\\s*<(rect|path|circle)\\b[^>]*\\bid="${escapeAttr(domId)}"[^>]*\\/?>\\s*`, "i");
    return svg.replace(re, "\n");
  }
  const name = el.attrs.name?.trim();
  if (name) {
    const re = new RegExp(`\\s*<(rect|path|circle)\\b[^>]*\\bname="${escapeAttr(name)}"[^>]*\\/?>\\s*`, "i");
    return svg.replace(re, "\n");
  }
  const tagRe = /<(rect|path|circle)\b[^>]*\/?>/gi;
  let n = 0;
  return svg.replace(tagRe, (match) => (n++ === idx ? "" : match));
}

export function canDeleteCombatMapElement(el: CombatMapElement): boolean {
  return el.kind !== "bounding_box";
}

export type InsertRectOptions = {
  kind: Exclude<CombatMapElementKind, "npc_token" | "unknown">;
  /** Stable element id (UUID). */
  id?: string;
  /** Sidebar / label text; defaults to wall-0-style names. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const COMBAT_MAP_DEFAULT_BOUNDS_FILL = "#ffffff";
export const COMBAT_MAP_DEFAULT_BOUNDS_STROKE = "#334155";

const RECT_DEFAULTS: Record<InsertRectOptions["kind"], Record<string, string>> = {
  bounding_box: { fill: COMBAT_MAP_DEFAULT_BOUNDS_FILL, stroke: COMBAT_MAP_DEFAULT_BOUNDS_STROKE },
  // barrier: full structural wall (blocks vision); cover-height is compile metadata, not SVG rect height
  barrier: { fill: "#c8c8c8", stroke: "#5c5c5c", ar: "15", ssp: "123", "cover-height": "1" },
  // concealment: soft cover (walk block, no vision block); cover-height is editable 掩体高度
  concealment: { fill: "#D9D9D9", ar: "15", ssp: "123", "cover-height": "0.75" },
  room: { fill: "#FFCC24", "fill-opacity": "0.18" },
};

export function insertCombatMapRect(svg: string, opts: InsertRectOptions): string {
  let x = opts.x;
  let y = opts.y;
  let width = opts.width;
  let height = opts.height;
  const mpu = combatMapMetersPerUnit(svg);
  const drawKind: CombatDrawTool =
    opts.kind === "bounding_box" ? "bounding_box" : opts.kind === "room" ? "room" : opts.kind;
  const minSvg = minCombatDrawRectSizeSvg(mpu, drawKind);
  const elementId = opts.id ?? newCombatMapElementId();
  const displayName = opts.name ?? nextElementDisplayName(svg, displayPrefixForKind(opts.kind));
  const attrs: Record<string, string> = {
    ...RECT_DEFAULTS[opts.kind],
    type: opts.kind,
    id: elementId,
    name: displayName,
    x: String(Math.round(x * 10) / 10),
    y: String(Math.round(y * 10) / 10),
    width: String(Math.max(minSvg, Math.round(width * 10) / 10)),
    height: String(Math.max(minSvg, Math.round(height * 10) / 10)),
  };
  const insert = `<rect ${attrsToString(attrs)}/>`;
  const next = svg.replace(/<\/svg>\s*$/i, `${insert}\n</svg>`);
  if (opts.kind === "bounding_box") return syncViewBoxToBoundingBox(next);
  return next;
}

export type InsertNpcTokenOptions = {
  id?: string;
  name?: string;
  sheetId: string;
  cx: number;
  cy: number;
  aiDifficulty?: NpcDifficultyId;
};

export function insertNpcToken(svg: string, opts: InsertNpcTokenOptions): string {
  let cx = opts.cx;
  let cy = opts.cy;
  const r = defaultNpcTokenRadiusSvg(combatMapMetersPerUnit(svg));
  const elementId = opts.id ?? newCombatMapElementId();
  const displayName = opts.name ?? nextElementDisplayName(svg, "npc");
  const attrs: Record<string, string> = {
    type: "npc_token",
    id: elementId,
    name: displayName,
    "sheet-id": opts.sheetId,
    cx: String(Math.round(cx * 10) / 10),
    cy: String(Math.round(cy * 10) / 10),
    r: String(Math.round(r * 10) / 10),
    fill: "#2563eb",
    stroke: "#1e3a8a",
    "stroke-width": "2",
    "ai-difficulty": opts.aiDifficulty ?? "trained",
  };
  const insert = `<circle ${attrsToString(attrs)}/>`;
  return svg.replace(/<\/svg>\s*$/i, `${insert}\n</svg>`);
}

export const DEFAULT_COMBAT_MAP_SIZE_M = { width: 20, height: 20 } as const;
/** SVG user units per meter for new maps (higher = finer coordinates). */
export const COMBAT_MAP_SVG_SCALE_FACTOR = 5;
export const DEFAULT_COMBAT_MAP_SVG_SIZE = {
  width: 200 * COMBAT_MAP_SVG_SCALE_FACTOR,
  height: 200 * COMBAT_MAP_SVG_SCALE_FACTOR,
} as const;

export function defaultCombatMapMetersPerUnit(): number {
  return DEFAULT_COMBAT_MAP_SIZE_M.width / DEFAULT_COMBAT_MAP_SVG_SIZE.width;
}

export function createDefaultCombatMapSvg(): string {
  const { width: w, height: h } = DEFAULT_COMBAT_MAP_SVG_SIZE;
  const mpu = defaultCombatMapMetersPerUnit();
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" meters-per-unit="${mpu}" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect id="bounds" name="bounds" x="0" y="0" width="${w}" height="${h}" type="bounding_box" fill="${COMBAT_MAP_DEFAULT_BOUNDS_FILL}" stroke="${COMBAT_MAP_DEFAULT_BOUNDS_STROKE}"/>
</svg>`;
}

export function createCombatMapDocument(title?: string): CombatMapDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title?.trim() || "Untitled combat",
    svg: createDefaultCombatMapSvg(),
    inCombat: false,
    updated_at: now,
  };
}

export function normalizeCombatMapDocument(raw: unknown): CombatMapDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.svg !== "string") return null;
  return {
    id: o.id,
    title: typeof o.title === "string" ? o.title : "Untitled combat",
    svg: o.svg,
    inCombat: o.inCombat === true,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : new Date().toISOString(),
    layerGroups: normalizeCombatMapLayerGroups(o.layerGroups),
  };
}

export function pruneCombatMapLayerGroups(
  svg: string,
  groups: readonly CombatMapLayerGroup[] | undefined,
): CombatMapLayerGroup[] {
  if (!groups?.length) return [];
  const ids = new Set(parseCombatMapElements(svg).map((el) => el.id));
  return groups
    .map((group) => ({ ...group, memberIds: group.memberIds.filter((id) => ids.has(id)) }))
    .filter((group) => group.memberIds.length > 0);
}

export function removeCombatMapLayerFromGroups(
  groups: readonly CombatMapLayerGroup[] | undefined,
  memberId: string,
): CombatMapLayerGroup[] {
  return removeLayerFromGroups(groups ?? [], memberId);
}

export function boundingBoxElement(svg: string): CombatMapElement | null {
  return parseCombatMapElements(svg).find((e) => e.kind === "bounding_box") ?? null;
}

export function mapBackgroundColor(svg: string): string {
  return boundingBoxElement(svg)?.attrs.fill ?? COMBAT_MAP_DEFAULT_BOUNDS_FILL;
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function mapArtboardFromSvg(svg: string): MapArtboard | null {
  const bounds = boundingBoxElement(svg);
  if (!bounds) return null;
  const artboard = mapArtboardFromAttrs(bounds.attrs);
  if (artboard.w <= 0 || artboard.h <= 0) return null;
  return artboard;
}

function elementPatchChangesAttrs(
  el: CombatMapElement,
  patch: Record<string, string>,
): boolean {
  return Object.entries(patch).some(([key, value]) => el.attrs[key] !== value);
}

export function clampAllMapElementsToArtboard(svg: string): string {
  const artboard = mapArtboardFromSvg(svg);
  if (!artboard) return svg;
  let next = svg;
  for (const el of parseCombatMapElements(svg)) {
    if (!shouldClampMapElement(el)) continue;
    // World AABB of a rotated rect must not be written as local width/height.
    if (el.tag === "rect" && rectElementIsRotated(el)) continue;
    const bounds = combatMapElementBounds(el);
    if (!bounds) continue;
    const clamped = clampRectToArtboard(bounds, artboard);
    const patch = patchElementToBounds(el, clamped);
    if (!Object.keys(patch).length || !elementPatchChangesAttrs(el, patch)) continue;
    next = updateCombatMapElement(next, el.id, patch);
  }
  return next;
}

function translateRotateTransform(transform: string, dx: number, dy: number): string {
  const m = /rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(transform);
  if (!m) return transform;
  return `rotate(${m[1]} ${round1(Number(m[2]) + dx)} ${round1(Number(m[3]) + dy)})`;
}

function moveElementByDelta(svg: string, el: CombatMapElement, dx: number, dy: number): string {
  if (el.tag === "rect") {
    const patch: Record<string, string> = {
      x: round1(Number(el.attrs.x ?? 0) + dx),
      y: round1(Number(el.attrs.y ?? 0) + dy),
    };
    if (el.attrs.transform) patch.transform = translateRotateTransform(el.attrs.transform, dx, dy);
    return updateCombatMapElement(svg, el.id, patch);
  }
  if (el.tag === "circle") {
    return updateCombatMapElement(svg, el.id, {
      cx: round1(Number(el.attrs.cx ?? 0) + dx),
      cy: round1(Number(el.attrs.cy ?? 0) + dy),
    });
  }
  if (el.tag === "path" && el.attrs.d) {
    return updateCombatMapElement(svg, el.id, { d: translatePathD(el.attrs.d, dx, dy) });
  }
  return svg;
}

export function moveCombatMapElement(svg: string, id: string, dx: number, dy: number): string {
  const elements = parseCombatMapElements(svg);
  const el = elements.find((e) => e.id === id);
  if (!el || (dx === 0 && dy === 0)) return svg;

  if (el.kind === "bounding_box") {
    let next = svg;
    for (const item of elements) next = moveElementByDelta(next, item, dx, dy);
    return next;
  }

  return moveElementByDelta(svg, el, dx, dy);
}

export function updateCombatMapPathVertex(
  svg: string,
  id: string,
  vertexIndex: number,
  x: number,
  y: number,
): string {
  const el = parseCombatMapElements(svg).find((e) => e.id === id);
  if (!el?.attrs.d) return svg;
  return updateCombatMapElement(svg, id, { d: setPathVertex(el.attrs.d, vertexIndex, x, y) });
}

export { parsePathD } from "./combat-map-path.ts";
