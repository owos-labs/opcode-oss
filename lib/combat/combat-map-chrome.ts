import { COMBAT_MAP_DEFAULT_BOUNDS_FILL } from "./combat-map-document.ts";

export type CombatMapEditorChrome = {
  gridMinor: string;
  gridMajor: string;
  boundsStroke: string;
  boundsStrokeWidth: string;
  rulerLine: string;
  rulerText: string;
  rulerTextStroke: string;
};

function expandHex(hex: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1]!.toLowerCase();
  if (raw.length === 3) {
    return raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return raw;
}

export function fillRelativeLuminance(fill: string | undefined): number | null {
  const hex = expandHex(fill ?? "");
  if (!hex) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function isDarkMapFill(fill: string | undefined): boolean {
  const lum = fillRelativeLuminance(fill);
  if (lum === null) return false;
  return lum < 0.35;
}

export function combatMapBoundsStroke(
  bounds: { attrs: { stroke?: string } } | null | undefined,
  chrome: CombatMapEditorChrome,
): string {
  const explicit = bounds?.attrs.stroke?.trim();
  return explicit || chrome.boundsStroke;
}

export function combatMapEditorChrome(fill = COMBAT_MAP_DEFAULT_BOUNDS_FILL): CombatMapEditorChrome {
  if (isDarkMapFill(fill)) {
    return {
      gridMinor: "rgba(255,255,255,0.12)",
      gridMajor: "rgba(255,255,255,0.20)",
      boundsStroke: "rgba(255,255,255,0.22)",
      boundsStrokeWidth: "1px",
      rulerLine: "rgba(255,255,255,0.22)",
      rulerText: "rgba(255,255,255,0.45)",
      rulerTextStroke: "rgba(0,0,0,0.35)",
    };
  }
  return {
    gridMinor: "rgba(15,23,42,0.10)",
    gridMajor: "rgba(15,23,42,0.16)",
    boundsStroke: "#94a3b8",
    boundsStrokeWidth: "1px",
    rulerLine: "#94a3b8",
    rulerText: "#475569",
    rulerTextStroke: "#f8fafc",
  };
}
