import type { OpcodeMapActorRuntime, OpcodeMapDocument } from "./map-adapter/opcode-map.types.ts";

export const COMBAT_TEST_MAP_SVG_PATH = "/combat/sample-map.svg";

export type CombatTestActor = OpcodeMapActorRuntime & {
  id: string;
  label: string;
};

/** Matches `opcodeMapDocumentFromSampleSvg()` runtime for terminal checks. */
export const COMBAT_TEST_PLACEHOLDER_ACTORS: readonly CombatTestActor[] = [
  { id: "npc-1", label: "NPC", x: 2, y: 5, team: "friendly" },
  { id: "hostile-1", label: "Hostile", x: 8, y: 5, team: "hostile" },
];

export type SvgViewBox = { x: number; y: number; w: number; h: number };

export function parseSvgViewBox(svg: string): SvgViewBox | null {
  const m = /viewBox="([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)"/i.exec(svg);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w, h };
}

/** Same default as `compileSvgMapShapes` when options.metersPerUnit is omitted. */
export function svgDefaultMetersPerUnit(viewBoxWidth: number): number {
  return 100 / Math.max(viewBoxWidth, 1);
}

/** Tactical meters (runtime actor x/y) → SVG user units for overlay markers. */
export function combatTestActorSvgUserPoint(
  actor: Pick<CombatTestActor, "x" | "y">,
  viewBox: SvgViewBox,
): { x: number; y: number } {
  const mpu = svgDefaultMetersPerUnit(viewBox.w);
  return {
    x: viewBox.x + actor.x / mpu,
    y: viewBox.y + actor.y / mpu,
  };
}

export function combatTestActorMarkerPercent(
  actor: Pick<CombatTestActor, "x" | "y">,
  viewBox: SvgViewBox,
): { leftPct: number; topPct: number } {
  const pt = combatTestActorSvgUserPoint(actor, viewBox);
  return {
    leftPct: ((pt.x - viewBox.x) / viewBox.w) * 100,
    topPct: ((pt.y - viewBox.y) / viewBox.h) * 100,
  };
}

export function combatTestPlaceholderDocument(svgMarkup: string): OpcodeMapDocument {
  const actors: Record<string, OpcodeMapActorRuntime> = {};
  for (const a of COMBAT_TEST_PLACEHOLDER_ACTORS) {
    actors[a.id] = { x: a.x, y: a.y, team: a.team };
  }
  return {
    name: "sample-map",
    base: { objects: svgMarkup },
    runtime: { actors },
  };
}
