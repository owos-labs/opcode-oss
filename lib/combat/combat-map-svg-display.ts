import {
  boundingBoxElement,
  COMBAT_MAP_DEFAULT_BOUNDS_FILL,
  COMBAT_MAP_DEFAULT_BOUNDS_STROKE,
} from "./combat-map-document.ts";

export type CombatMapSvgDisplayMode = "bench" | "editor";

function boundsRectTag(markup: string): string | null {
  const bounds = boundingBoxElement(markup);
  if (!bounds || bounds.tag !== "rect") return null;
  const name = bounds.attrs.name;
  if (name) {
    const byName = new RegExp(`<rect\\b[^>]*\\bname="${name}"[^>]*/>`, "i").exec(markup);
    if (byName) return byName[0];
  }
  return new RegExp(`<rect\\b[^>]*\\btype="bounding_box"[^>]*/>`, "i").exec(markup)?.[0] ?? null;
}

/** Keep the artboard fill under every other shape in the editor. */
export function sendBoundsToBack(markup: string): string {
  const tag = boundsRectTag(markup);
  if (!tag) return markup;
  const tagRe = new RegExp(`\\s*${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
  let next = markup.replace(tagRe, "\n");
  if (/<\/style>/i.test(next)) {
    next = next.replace(/<\/style>/i, `</style>\n${tag}`);
  } else {
    next = next.replace(/<svg([^>]*)>/i, `<svg$1>\n${tag}`);
  }
  return next;
}

/** Inline combat map SVG: default fills for shapes missing fill (root svg uses fill="none"). */
export function prepareCombatMapSvgForDisplay(
  markup: string,
  mode: CombatMapSvgDisplayMode = "bench",
): string {
  if (!/<svg[\s>]/i.test(markup)) return markup;
  const roomPointer = mode === "editor" ? "pointer-events: auto;" : "pointer-events: none;";
  const style =
    mode === "editor"
      ? `<style>
.combat-map-svg rect[type="bounding_box"] { pointer-events: none; stroke: none; }
.combat-map-svg rect[type="bounding_box"]:not([fill]) { fill: ${COMBAT_MAP_DEFAULT_BOUNDS_FILL}; }
.combat-map-svg rect[type="bounding_box"]:not([stroke]) { stroke: ${COMBAT_MAP_DEFAULT_BOUNDS_STROKE}; }
.combat-map-svg rect[type="barrier"]:not([fill]) { fill: #c8c8c8; }
.combat-map-svg path[type="barrier"]:not([fill]) { fill: #b0b0b0; }
.combat-map-svg rect[type="concealment"]:not([fill]) { fill: #8fafc9; opacity: 0.92; }
.combat-map-svg rect[type="barrier"],.combat-map-svg path[type="barrier"],.combat-map-svg rect[type="concealment"] { stroke: none; }
.combat-map-svg [type="room"] { ${roomPointer} }
</style>`
      : `<style>
.combat-map-svg [type="barrier"] { fill: #c8c8c8; stroke: #5c5c5c; stroke-width: 1px; }
.combat-map-svg [type="concealment"] { fill: #8fafc9; stroke: #4a6785; stroke-width: 1px; opacity: 0.92; }
.combat-map-svg [type="bounding_box"] { stroke-width: 2px; vector-effect: non-scaling-stroke; }
.combat-map-svg [type="bounding_box"]:not([fill]) { fill: ${COMBAT_MAP_DEFAULT_BOUNDS_FILL}; }
.combat-map-svg [type="bounding_box"]:not([stroke]) { stroke: ${COMBAT_MAP_DEFAULT_BOUNDS_STROKE}; }
.combat-map-svg [type="room"] { fill: #FFCC24; fill-opacity: 0.18; stroke: none; ${roomPointer} }
.combat-map-svg path[type="barrier"] { fill: #b0b0b0; stroke: #5c5c5c; stroke-width: 1px; }
</style>`;
  let next = markup.replace(/<svg([^>]*)>/i, (_, attrs: string) => {
    let a = attrs;
    if (!/\boverflow=/i.test(a)) a += ' overflow="visible"';
    if (!/\bclass="/i.test(a)) a += ' class="combat-map-svg"';
    else a = a.replace(/\bclass="/i, 'class="combat-map-svg ');
    return `<svg${a}>${style}`;
  });
  if (mode === "editor") next = sendBoundsToBack(next);
  return next;
}
