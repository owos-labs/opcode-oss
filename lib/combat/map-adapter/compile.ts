import type { BallisticBarrier } from "../../combat-ai/geometry.ts";
import type { CoverEmplacement } from "../../combat-ai/cover-concealment-view.ts";
import type { WallSegment } from "../../combat-ai/visibility.ts";
import type { MapSolveBounds } from "./compile-svg-map.ts";
import type { CombatMapDto } from "./types.ts";

export type CompiledCombatMap = {
  mapId: string;
  walls: WallSegment[];
  barriers: BallisticBarrier[];
  emplacements: CoverEmplacement[];
  /** AI stance sampling clip (from SVG type=bounding_box). */
  solveBounds?: MapSolveBounds | null;
};

export function compileCombatMap(dto: CombatMapDto): CompiledCombatMap {
  const barriers: BallisticBarrier[] = dto.segments.map(seg => ({
    id: seg.id,
    a: seg.a,
    b: seg.b,
    armorRating: seg.armorRating,
    maxSsp: seg.maxSsp,
    currentSsp: seg.currentSsp,
    blocksVision: seg.blocksVision !== false,
  }));

  const walls = barriers.filter(b => b.blocksVision).map(b => ({ a: b.a, b: b.b }));

  const emplacements: CoverEmplacement[] = (dto.emplacements ?? []).map(e => ({
    id: e.id,
    emplacement: e.emplacement,
    distanceToEnter: e.distanceToEnter,
  }));

  return { mapId: dto.id, walls, barriers, emplacements };
}
