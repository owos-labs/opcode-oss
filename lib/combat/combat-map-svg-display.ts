/** Inline combat map SVG: default fills for shapes missing fill (root svg uses fill="none"). */
export function prepareCombatMapSvgForDisplay(markup: string): string {
  if (!/<svg[\s>]/i.test(markup)) return markup;
  const style = `<style>
.combat-map-svg [type="barrier"] { fill: #c8c8c8; stroke: #5c5c5c; stroke-width: 1px; }
.combat-map-svg [type="concealment"] { fill: #8fafc9; stroke: #4a6785; stroke-width: 1px; opacity: 0.92; }
.combat-map-svg [type="bounding_box"] { fill: #f4f1ea; stroke: #2a2a2a; stroke-width: 1px; }
.combat-map-svg path[type="barrier"] { fill: #b0b0b0; stroke: #5c5c5c; stroke-width: 1px; }
</style>`;
  return markup.replace(/<svg([^>]*)>/i, (match, attrs: string) => {
    const withClass = /\bclass="/i.test(attrs)
      ? match.replace(/\bclass="/i, 'class="combat-map-svg ')
      : `<svg${attrs} class="combat-map-svg">`;
    return `${withClass}${style}`;
  });
}
