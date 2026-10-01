import type { OpcodeMapActorRuntime, OpcodeMapDocument } from "./map-adapter/opcode-map.types.ts";

export const COMBAT_BENCH_MAPS = [
  { id: "sample", path: "/combat/sample-map.svg", labelKey: "combat.bench.map.sample", widthMeters: 100 },
  {
    id: "connected-walls",
    path: "/combat/connected-walls.svg",
    labelKey: "combat.bench.map.connectedWalls",
    // 88px left-bay vehicles = 1.8m wide; door gap under them is ~1.1m.
    widthMeters: (1049 * 1.8) / 88,
  },
] as const;

export type CombatBenchMapId = (typeof COMBAT_BENCH_MAPS)[number]["id"];

export const COMBAT_TEST_MAP_SVG_PATH = COMBAT_BENCH_MAPS[0].path;

export function combatBenchMapById(id: string) {
  return COMBAT_BENCH_MAPS.find((m) => m.id === id) ?? COMBAT_BENCH_MAPS[0];
}

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
export function svgDefaultMetersPerUnit(viewBoxWidth: number, widthMeters = 100): number {
  return widthMeters / Math.max(viewBoxWidth, 1);
}

export function combatBenchMapMetersPerUnit(mapId: string, viewBoxWidth: number): number {
  return svgDefaultMetersPerUnit(viewBoxWidth, combatBenchMapById(mapId).widthMeters);
}

/** Tactical meters (runtime actor x/y) → SVG user units for overlay markers. */
export function combatTestActorSvgUserPoint(
  actor: Pick<CombatTestActor, "x" | "y">,
  viewBox: SvgViewBox,
  metersPerUnit?: number,
): { x: number; y: number } {
  const mpu = metersPerUnit ?? svgDefaultMetersPerUnit(viewBox.w);
  return {
    x: viewBox.x + actor.x / mpu,
    y: viewBox.y + actor.y / mpu,
  };
}

export function combatTestActorMarkerPercent(
  actor: Pick<CombatTestActor, "x" | "y">,
  viewBox: SvgViewBox,
  metersPerUnit?: number,
): { leftPct: number; topPct: number } {
  const pt = combatTestActorSvgUserPoint(actor, viewBox, metersPerUnit);
  return {
    leftPct: ((pt.x - viewBox.x) / viewBox.w) * 100,
    topPct: ((pt.y - viewBox.y) / viewBox.h) * 100,
  };
}

export function combatTestPlaceholderDocument(
  svgMarkup: string,
  mapId = "sample-map",
  metersPerUnit?: number,
): OpcodeMapDocument {
  const actors: Record<string, OpcodeMapActorRuntime> = {};
  for (const a of COMBAT_TEST_PLACEHOLDER_ACTORS) {
    actors[a.id] = { x: a.x, y: a.y, team: a.team };
  }
  return {
    name: mapId,
    base: {
      objects: svgMarkup,
      ...(metersPerUnit !== undefined ? { metersPerUnit } : {}),
    },
    runtime: { actors },
  };
}
