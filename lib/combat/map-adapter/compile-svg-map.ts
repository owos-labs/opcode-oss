import type { CoverHeightBand } from "../../combat-ai/cover-concealment-view.ts";
import type { BallisticBarrier } from "../../combat-ai/geometry.ts";
import type { Vec2 } from "../../combat-ai/visibility.ts";
import { coverHeightBandFromFraction } from "../cover-height.ts";
import type { MapSegmentDto } from "./types.ts";

export type SvgMapElementType = "bounding_box" | "barrier" | "concealment";

export type SvgCompileOptions = {
  /** Meters per SVG user unit; default viewBox width → 100m. */
  metersPerUnit?: number;
};

export type MapSolveBounds = {
  min: Vec2;
  max: Vec2;
};

export type ParsedSvgShape = {
  id: string;
  kind: SvgMapElementType;
  ar: number;
  ssp: number;
  coverHeightBand: CoverHeightBand;
  blocksVision: boolean;
  ring: Vec2[];
};

export type SvgMapGeometry = {
  barriers: BallisticBarrier[];
  solveBounds: MapSolveBounds | null;
};

const TAG_RE = /<(rect|path)\b([^>]*)\/?>/gi;

function parseAttrs(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

function num(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function viewBoxMetersPerUnit(svg: string): number {
  const m = /viewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+[\d.]+"/i.exec(svg);
  const w = m ? Number(m[1]) : 1000;
  return 100 / Math.max(w, 1);
}

/** Logical cover height on barrier/concealment (not SVG rect pixel height). */
export function parseCoverHeightFraction(
  attrs: Record<string, string>,
  tag: "rect" | "path",
): number | undefined {
  const raw =
    attrs["cover-height"] ??
    attrs.cover_height ??
    (tag === "path" ? attrs.height : undefined);
  if (raw === undefined) return undefined;
  const f = Number(raw);
  return Number.isFinite(f) ? f : undefined;
}

function rotatePoint(p: Vec2, cx: number, cy: number, deg: number): Vec2 {
  if (deg === 0) return p;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function parseTransform(transform: string | undefined): { rotateDeg: number; cx: number; cy: number } {
  if (!transform) return { rotateDeg: 0, cx: 0, cy: 0 };
  const m = /rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(transform);
  if (!m) return { rotateDeg: 0, cx: 0, cy: 0 };
  return { rotateDeg: Number(m[1]), cx: Number(m[2]), cy: Number(m[3]) };
}

function scaleRing(ring: Vec2[], metersPerUnit: number): Vec2[] {
  return ring.map(p => ({ x: p.x * metersPerUnit, y: p.y * metersPerUnit }));
}

function ringBounds(ring: Vec2[]): MapSolveBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

function rectRing(attrs: Record<string, string>): Vec2[] {
  const x = num(attrs.x, 0);
  const y = num(attrs.y, 0);
  const w = num(attrs.width, 0);
  const h = num(attrs.height, 0);
  const { rotateDeg, cx, cy } = parseTransform(attrs.transform);
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  return corners.map(p => rotatePoint(p, cx, cy, rotateDeg));
}

function pathRing(d: string): Vec2[] {
  const pts: Vec2[] = [];
  const re = /([ML])\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    pts.push({ x: Number(m[2]), y: Number(m[3]) });
  }
  return pts;
}

function shapeMeta(
  attrs: Record<string, string>,
  tag: "rect" | "path",
): Omit<ParsedSvgShape, "id" | "ring"> {
  const kind = (attrs.type ?? "barrier") as SvgMapElementType;
  const ar = num(attrs.ar, kind === "bounding_box" ? 0 : 15);
  const ssp = num(attrs.ssp, kind === "bounding_box" ? 0 : 100);
  const coverF = parseCoverHeightFraction(attrs, tag);
  const coverHeightBand =
    coverF !== undefined ? coverHeightBandFromFraction(coverF) : "none";
  const blocksVision = kind === "concealment" ? false : kind !== "bounding_box";
  return { kind, ar, ssp, coverHeightBand, blocksVision };
}

export function parseSvgMapShapes(svg: string, options?: SvgCompileOptions): ParsedSvgShape[] {
  const mpu = options?.metersPerUnit ?? viewBoxMetersPerUnit(svg);
  const shapes: ParsedSvgShape[] = [];
  let index = 0;

  for (const match of svg.matchAll(TAG_RE)) {
    const tag = match[1]!.toLowerCase() as "rect" | "path";
    const attrs = parseAttrs(match[2] ?? "");
    const kind = (attrs.type ?? "barrier") as SvgMapElementType;

    const id = attrs.name || attrs.id || `${tag}-${index++}`;
    const meta = shapeMeta(attrs, tag);
    let ring: Vec2[] = [];
    if (tag === "rect") ring = rectRing(attrs);
    else if (tag === "path") ring = pathRing(attrs.d ?? "");

    ring = scaleRing(ring, mpu);
    if (ring.length >= 2) shapes.push({ id, ring, ...meta });
  }

  return shapes;
}

function ringToBarriers(shape: ParsedSvgShape): BallisticBarrier[] {
  const out: BallisticBarrier[] = [];
  const ring = shape.ring;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue;
    out.push({
      id: `${shape.id}-e${i}`,
      a,
      b,
      armorRating: shape.ar,
      maxSsp: shape.ssp,
      currentSsp: shape.ssp,
      blocksVision: shape.blocksVision,
      coverHeightBand: shape.coverHeightBand,
    });
  }
  return out;
}

/** Full SVG compile: barriers + optional solve bounds from type=bounding_box. */
export function compileSvgMapGeometry(
  svg: string,
  options?: SvgCompileOptions,
): SvgMapGeometry {
  const barriers: BallisticBarrier[] = [];
  let solveBounds: MapSolveBounds | null = null;

  for (const shape of parseSvgMapShapes(svg, options)) {
    if (shape.kind === "bounding_box") {
      solveBounds = ringBounds(shape.ring);
      continue;
    }
    barriers.push(...ringToBarriers(shape));
  }

  return { barriers, solveBounds };
}

export function compileSvgToSegments(svg: string, options?: SvgCompileOptions): MapSegmentDto[] {
  return compileSvgMapGeometry(svg, options).barriers.map(b => ({
    id: b.id,
    a: b.a,
    b: b.b,
    armorRating: b.armorRating,
    maxSsp: b.maxSsp,
    currentSsp: b.currentSsp,
    blocksVision: b.blocksVision,
  }));
}

export function compileSvgToBarriers(
  svg: string,
  options?: SvgCompileOptions,
): BallisticBarrier[] {
  return compileSvgMapGeometry(svg, options).barriers;
}
