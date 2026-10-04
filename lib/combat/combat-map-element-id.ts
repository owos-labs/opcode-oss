import { namePrefixForCombatElement } from "./combat-map-clipboard.ts";
import {
  newCombatMapElementId,
  nextElementDisplayName,
  parseCombatMapElements,
  updateCombatMapElement,
  type CombatMapElement,
} from "./combat-map-document.ts";

export const COMBAT_MAP_SHAPE_SELECTOR = 'rect[type], path[type], circle[type]';
export const COMBAT_MAP_SELECTABLE_SHAPE_SELECTOR = `${COMBAT_MAP_SHAPE_SELECTOR}:not([type="bounding_box"])`;

function trimmedAttr(attrs: Record<string, string>, key: string): string {
  return attrs[key]?.trim() ?? "";
}

/** Canonical element id (SVG `id` attribute). */
export function combatMapElementIdentity(attrs: Record<string, string>): string {
  return trimmedAttr(attrs, "id") || trimmedAttr(attrs, "name");
}

export function combatMapShapeSignatureFromAttrs(
  tag: CombatMapElement["tag"],
  attrs: Record<string, string>,
): string {
  const type = trimmedAttr(attrs, "type");
  if (tag === "rect") {
    return ["rect", type, trimmedAttr(attrs, "x"), trimmedAttr(attrs, "y"), trimmedAttr(attrs, "width"), trimmedAttr(attrs, "height"), trimmedAttr(attrs, "transform")].join("\0");
  }
  if (tag === "circle") {
    return ["circle", type, trimmedAttr(attrs, "cx"), trimmedAttr(attrs, "cy"), trimmedAttr(attrs, "r"), trimmedAttr(attrs, "transform")].join("\0");
  }
  return ["path", type, trimmedAttr(attrs, "d"), trimmedAttr(attrs, "transform")].join("\0");
}

export function combatMapShapeSignatureFromElement(el: CombatMapElement): string {
  return combatMapShapeSignatureFromAttrs(el.tag, el.attrs);
}

export function combatMapShapeSignatureFromDom(node: Element): string {
  const tag = node.tagName.toLowerCase();
  if (tag !== "rect" && tag !== "path" && tag !== "circle") return "";
  const attrs: Record<string, string> = {};
  for (const name of node.getAttributeNames()) {
    const value = node.getAttribute(name);
    if (value !== null) attrs[name] = value;
  }
  return combatMapShapeSignatureFromAttrs(tag, attrs);
}

export function combatMapElementIdFromDom(node: Element, svg: string): string | null {
  const direct = node.getAttribute("id")?.trim() || node.getAttribute("name")?.trim();
  if (direct) {
    const parsed = parseCombatMapElements(svg).find((el) => el.id === direct);
    if (parsed) return parsed.id;
  }

  const sig = combatMapShapeSignatureFromDom(node);
  if (!sig) return null;
  const match = parseCombatMapElements(svg).find((el) => combatMapShapeSignatureFromElement(el) === sig);
  return match?.id ?? null;
}

export function closestCombatMapSelectableShape(target: Element | null): Element | null {
  return target?.closest(COMBAT_MAP_SELECTABLE_SHAPE_SELECTOR) ?? null;
}

export function combatMapNpcTokenIdFromDom(target: Element | null, svg: string): string | null {
  const shape = closestCombatMapSelectableShape(target);
  if (!shape) return null;
  const id = combatMapElementIdFromDom(shape, svg);
  if (!id) return null;
  const el = parseCombatMapElements(svg).find((entry) => entry.id === id);
  return el?.kind === "npc_token" ? id : null;
}

/** Resolve the element id after a patch (`id` edits change canonical ids; `name` is display-only). */
export function combatMapElementIdAfterUpdate(
  svg: string,
  patchedId: string,
  patch: Record<string, string | undefined>,
): { svg: string; id: string } {
  const nextSvg = updateCombatMapElement(svg, patchedId, patch);
  const nextId = patch.id?.trim();
  if (nextId) {
    const after = parseCombatMapElements(nextSvg).find((entry) => entry.id === nextId);
    return { svg: nextSvg, id: after?.id ?? nextId };
  }
  return { svg: nextSvg, id: patchedId };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Assign UUID `id` attrs and display `name` labels to legacy or unnamed shapes. */
export function ensureCombatMapElementIds(svg: string): string {
  let next = svg;
  for (const el of parseCombatMapElements(next)) {
    const domId = el.attrs.id?.trim();
    const displayName = el.attrs.name?.trim();
    const patch: Record<string, string> = {};

    if (el.kind === "bounding_box") {
      if (!domId) patch.id = "bounds";
      if (!displayName) patch.name = "bounds";
    } else if (!domId) {
      patch.id = newCombatMapElementId();
      patch.name = displayName || nextElementDisplayName(next, namePrefixForCombatElement(el));
    } else if (!isUuid(domId)) {
      patch.id = newCombatMapElementId();
      if (!displayName) patch.name = domId;
    } else if (!displayName) {
      patch.name = nextElementDisplayName(next, namePrefixForCombatElement(el));
    }

    if (Object.keys(patch).length === 0) continue;
    next = updateCombatMapElement(next, el.id, patch);
  }
  return next;
}

/** @deprecated Use ensureCombatMapElementIds. */
export const ensureCombatMapElementNames = ensureCombatMapElementIds;
