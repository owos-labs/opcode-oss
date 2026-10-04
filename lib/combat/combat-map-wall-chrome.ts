import type { CombatMapElement } from "./combat-map-document.ts";
import { rectLocalBounds } from "./combat-map-rotate.ts";

export const COMBAT_MAP_WALL_STROKE = {
  barrier: "#5c5c5c",
  concealment: "#4a6785",
} as const;

export type WallChromeStroke =
  | {
      id: string;
      kind: "barrier" | "concealment";
      tag: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      stroke: string;
      transform?: string;
    }
  | {
      id: string;
      kind: "barrier" | "concealment";
      tag: "path";
      d: string;
      stroke: string;
    };

export function wallStrokeColor(el: CombatMapElement): string | null {
  if (el.kind !== "barrier" && el.kind !== "concealment") return null;
  const explicit = el.attrs.stroke?.trim();
  if (explicit) return explicit;
  return COMBAT_MAP_WALL_STROKE[el.kind];
}

export function collectCombatMapWallStrokes(elements: readonly CombatMapElement[]): WallChromeStroke[] {
  const out: WallChromeStroke[] = [];
  for (const el of elements) {
    const stroke = wallStrokeColor(el);
    if (!stroke) continue;
    if (el.tag === "rect") {
      const bounds = rectLocalBounds(el);
      if (!bounds) continue;
      const transform = el.attrs.transform?.trim();
      out.push({
        id: el.id,
        kind: el.kind as "barrier" | "concealment",
        tag: "rect",
        stroke,
        ...bounds,
        ...(transform ? { transform } : {}),
      });
    } else if (el.tag === "path" && el.attrs.d) {
      out.push({
        id: el.id,
        kind: el.kind as "barrier" | "concealment",
        tag: "path",
        d: el.attrs.d,
        stroke,
      });
    }
  }
  return out;
}
