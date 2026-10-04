import type { CombatMapElement } from "./combat-map-document.ts";
import { boundingBoxElement, moveCombatMapElement } from "./combat-map-document.ts";
import {
  combatMapElementBounds,
  type ElementBounds,
} from "./combat-map-element-geometry.ts";

export function clickSelectIds(current: readonly string[], id: string, additive: boolean): string[] {
  if (additive) {
    if (current.includes(id)) return current.filter((entry) => entry !== id);
    return [...current, id];
  }
  return [id];
}

/** Canvas pointer-down: keep multi-select when dragging an already-selected item. */
export function selectIdsForPointerDown(
  current: readonly string[],
  id: string,
  additive: boolean,
): string[] {
  if (additive) return clickSelectIds(current, id, true);
  if (current.includes(id) && current.length > 1) return [...current];
  return [id];
}

export function primarySelectionId(ids: readonly string[]): string | null {
  return ids.length > 0 ? ids[ids.length - 1]! : null;
}

export function boundsFromTwoPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): ElementBounds {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export function boundsIntersect(a: ElementBounds, b: ElementBounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function selectIdsInMarquee(
  elements: readonly CombatMapElement[],
  rect: ElementBounds,
  current: readonly string[],
  additive: boolean,
  minSizeMapUnits = 0,
): string[] {
  if (rect.width < minSizeMapUnits && rect.height < minSizeMapUnits) {
    return additive ? [...current] : [];
  }
  const hit = elements
    .filter((el) => el.kind !== "bounding_box")
    .filter((el) => {
      const bounds = combatMapElementBounds(el);
      return bounds && boundsIntersect(bounds, rect);
    })
    .map((el) => el.id);
  if (additive) {
    const merged = new Set(current);
    for (const id of hit) merged.add(id);
    return [...merged];
  }
  return hit;
}

/** Move a canvas selection; dragging bounds moves the whole map once. */
export function moveCombatMapSelection(
  svg: string,
  ids: readonly string[],
  dragId: string,
  dx: number,
  dy: number,
): string {
  if (dx === 0 && dy === 0 || ids.length === 0) return svg;

  const bounds = boundingBoxElement(svg);
  const boundsId = bounds?.id;
  if (boundsId && dragId === boundsId) {
    return moveCombatMapElement(svg, boundsId, dx, dy);
  }

  let next = svg;
  for (const id of ids) {
    if (boundsId && id === boundsId) continue;
    next = moveCombatMapElement(next, id, dx, dy);
  }
  return next;
}
