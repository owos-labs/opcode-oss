import { combatMapElementIdFromDom } from "./combat-map-element-id.ts";

export type RectDomPatch = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  transform?: string | null;
};

export type PathDomPatch = {
  d?: string;
};

export type StyleDomPatch = {
  fill?: string;
  stroke?: string;
};

export function queryMapElement(
  root: ParentNode | null | undefined,
  id: string,
  svg?: string,
): Element | null {
  if (!root) return null;
  const byId = root.querySelector(`[id="${CSS.escape(id)}"]`);
  if (byId) return byId;
  const byName = root.querySelector(`[name="${CSS.escape(id)}"]`);
  if (byName) return byName;
  if (!svg) return null;
  for (const node of root.querySelectorAll("rect[type], path[type], circle[type]")) {
    if (combatMapElementIdFromDom(node, svg) === id) return node;
  }
  return null;
}

export function queryWallStroke(root: ParentNode | null | undefined, id: string): Element | null {
  if (!root) return null;
  return root.querySelector(`[data-wall-stroke-id="${CSS.escape(id)}"]`);
}

export function applyRectDomPatch(node: Element | null | undefined, patch: RectDomPatch): void {
  if (!node) return;
  if (patch.x !== undefined) node.setAttribute("x", String(patch.x));
  if (patch.y !== undefined) node.setAttribute("y", String(patch.y));
  if (patch.width !== undefined) node.setAttribute("width", String(patch.width));
  if (patch.height !== undefined) node.setAttribute("height", String(patch.height));
  if (patch.transform === null) node.removeAttribute("transform");
  else if (patch.transform !== undefined) node.setAttribute("transform", patch.transform);
}

export function applyPathDomPatch(node: Element | null | undefined, patch: PathDomPatch): void {
  if (!node || patch.d === undefined) return;
  node.setAttribute("d", patch.d);
}

export function applyStyleDomPatch(node: Element | null | undefined, patch: StyleDomPatch): void {
  if (!node) return;
  if (patch.fill !== undefined) node.setAttribute("fill", patch.fill);
  if (patch.stroke !== undefined) node.setAttribute("stroke", patch.stroke);
}

export function previewMapRect(
  mapRoot: ParentNode | null | undefined,
  overlayRoot: ParentNode | null | undefined,
  id: string,
  patch: RectDomPatch,
): void {
  applyRectDomPatch(queryMapElement(mapRoot, id), patch);
  applyRectDomPatch(queryWallStroke(overlayRoot, id), patch);
}

export function previewMapPath(
  mapRoot: ParentNode | null | undefined,
  overlayRoot: ParentNode | null | undefined,
  id: string,
  patch: PathDomPatch,
): void {
  applyPathDomPatch(queryMapElement(mapRoot, id), patch);
  applyPathDomPatch(queryWallStroke(overlayRoot, id), patch);
}

export function previewMapStyle(
  mapRoot: ParentNode | null | undefined,
  overlayRoot: ParentNode | null | undefined,
  id: string,
  patch: StyleDomPatch,
  svg?: string,
): void {
  applyStyleDomPatch(queryMapElement(mapRoot, id, svg), patch);
  applyStyleDomPatch(queryWallStroke(overlayRoot, id), patch);
}

export function rectPatchFromAttrs(attrs: Record<string, string>): RectDomPatch {
  const patch: RectDomPatch = {};
  if (attrs.x !== undefined) patch.x = Number(attrs.x);
  if (attrs.y !== undefined) patch.y = Number(attrs.y);
  if (attrs.width !== undefined) patch.width = Number(attrs.width);
  if (attrs.height !== undefined) patch.height = Number(attrs.height);
  if (attrs.transform) patch.transform = attrs.transform;
  else if ("transform" in attrs) patch.transform = null;
  return patch;
}
