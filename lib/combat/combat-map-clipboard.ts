import {
  newCombatMapElementId,
  nextElementDisplayName,
  parseCombatMapElements,
  type CombatMapElement,
} from "./combat-map-document.ts";
import { translatePathD } from "./combat-map-path.ts";

const TAG_SNIPPET_RE = /<(rect|path|circle)\b([^>]*)\/?>/i;

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

function parseAttrs(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

function inferKind(attrs: Record<string, string>): CombatMapElement["kind"] {
  const t = attrs.type;
  if (t === "bounding_box" || t === "barrier" || t === "concealment" || t === "room" || t === "npc_token") {
    return t;
  }
  if (/^#ffcc24$/i.test(attrs.fill ?? "")) return "room";
  return "unknown";
}

function translateRotateTransform(transform: string, dx: number, dy: number): string {
  const m = /rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(transform);
  if (!m) return transform;
  return `rotate(${m[1]} ${round1(Number(m[2]) + dx)} ${round1(Number(m[3]) + dy)})`;
}

export function namePrefixForCombatElement(el: CombatMapElement): string {
  const name = el.attrs.name ?? el.id;
  const matched = /^([a-zA-Z_]+)-\d+$/.exec(name);
  if (matched) return matched[1]!;
  switch (el.kind) {
    case "barrier":
      return "wall";
    case "concealment":
      return "cover";
    case "room":
      return "room";
    case "npc_token":
      return "npc";
    default:
      return "el";
  }
}

export function combatMapElementToTag(el: CombatMapElement): string {
  return `<${el.tag} ${attrsToString(el.attrs)}/>`;
}

export function parseCombatMapElementTag(text: string): CombatMapElement | null {
  const matched = TAG_SNIPPET_RE.exec(text.trim());
  if (!matched) return null;
  const tag = matched[1]!.toLowerCase() as CombatMapElement["tag"];
  const attrs = parseAttrs(matched[2] ?? "");
  const id = attrs.name || attrs.id || `${tag}-paste`;
  return { id, kind: inferKind(attrs), tag, attrs: { ...attrs } };
}

export function offsetCombatMapAttrs(
  tag: CombatMapElement["tag"],
  attrs: Record<string, string>,
  dx: number,
  dy: number,
): Record<string, string> {
  const next = { ...attrs };
  if (tag === "rect") {
    next.x = round1(Number(attrs.x ?? 0) + dx);
    next.y = round1(Number(attrs.y ?? 0) + dy);
    if (attrs.transform) next.transform = translateRotateTransform(attrs.transform, dx, dy);
    return next;
  }
  if (tag === "circle") {
    next.cx = round1(Number(attrs.cx ?? 0) + dx);
    next.cy = round1(Number(attrs.cy ?? 0) + dy);
    return next;
  }
  if (tag === "path" && attrs.d) next.d = translatePathD(attrs.d, dx, dy);
  return next;
}

export function copyCombatMapElementFromSvg(svg: string, id: string): string | null {
  const el = parseCombatMapElements(svg).find((e) => e.id === id);
  if (!el || el.kind === "bounding_box") return null;
  return combatMapElementToTag(el);
}

export function pasteCombatMapElement(
  svg: string,
  tagText: string,
  offset = { dx: 16, dy: 16 },
): { svg: string; id: string } | null {
  const parsed = parseCombatMapElementTag(tagText);
  if (!parsed || parsed.kind === "bounding_box" || parsed.kind === "unknown") return null;

  const id = newCombatMapElementId();
  const displayName = nextElementDisplayName(svg, namePrefixForCombatElement(parsed));
  const attrs = offsetCombatMapAttrs(parsed.tag, { ...parsed.attrs, id, name: displayName }, offset.dx, offset.dy);
  const insert = `<${parsed.tag} ${attrsToString(attrs)}/>`;
  let next = svg.replace(/<\/svg>\s*$/i, `${insert}\n</svg>`);

  return { svg: next, id };
}
