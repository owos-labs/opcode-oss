import type { BallisticBarrier } from "../../combat-ai/geometry.ts";
import type { CoverEmplacement } from "../../combat-ai/cover-concealment-view.ts";
import { bakeWalkWalls, walkWalls } from "../../combat-ai/walk-path.ts";
import type { Vec2, WallSegment } from "../../combat-ai/visibility.ts";
import type { MapSolveBounds } from "./compile-svg-map.ts";
import type { CombatMapDto } from "./types.ts";

export type CompiledCombatMap = {
  mapId: string;
  walls: WallSegment[];
  /** Cover outlines that block walk (vehicles, columns). Vision still uses `walls`. */
  navWalls?: WallSegment[];
  barriers: BallisticBarrier[];
  emplacements: CoverEmplacement[];
  /** AI stance sampling clip (from SVG type=bounding_box). */
  solveBounds?: MapSolveBounds | null;
  /** Yellow / type=room rects from the SVG parser. */
  authoredRooms?: { id: string; centroid: Vec2; cells: Vec2[] }[];
  /** Meters per SVG user unit used when this map was compiled. */
  metersPerUnit?: number;
};

export function combatMapWalkWalls(map: CompiledCombatMap): WallSegment[] {
  return walkWalls(map.navWalls ?? map.walls, map.solveBounds);
}

export function compileCombatMap(dto: CombatMapDto): CompiledCombatMap {
  const barriers: BallisticBarrier[] = dto.segments.map(seg => ({
    id: seg.id,
    a: seg.a,
    b: seg.b,
    armorRating: seg.armorRating,
    maxSsp: seg.maxSsp,
    currentSsp: seg.currentSsp,
    blocksVision: seg.blocksVision !== false,
    coverHeightBand: seg.coverHeightBand,
  }));

  const walls = bakeWalkWalls(barriers.filter(b => b.blocksVision).map(b => ({ a: b.a, b: b.b })));

  const emplacements: CoverEmplacement[] = (dto.emplacements ?? []).map(e => ({
    id: e.id,
    emplacement: e.emplacement,
    distanceToEnter: e.distanceToEnter,
  }));

  return { mapId: dto.id, walls, barriers, emplacements };
}
