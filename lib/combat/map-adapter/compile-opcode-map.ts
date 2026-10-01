import type { BallisticBarrier } from "../../combat-ai/geometry.ts";
import type { CoverEmplacement } from "../../combat-ai/cover-concealment-view.ts";
import { bakeWalkWalls, unionWalkRings } from "../../combat-ai/walk-path.ts";
import type { Vec2, WallSegment } from "../../combat-ai/visibility.ts";
import type { CompiledCombatMap } from "./compile.ts";
import type { MapSolveBounds } from "./compile-svg-map.ts";
import type {
  OpcodeMapActorRuntime,
  OpcodeMapDocument,
  OpcodeMapObject,
  OpcodeMapCompileResult,
} from "./opcode-map.types.ts";
import { combatRoomsFromRings } from "../rooms.ts";
import { compileSvgMapGeometry } from "./compile-svg-map.ts";
import type { MapSegmentDto } from "./types.ts";

const DEG = Math.PI / 180;

function objectSize(obj: OpcodeMapObject): { w: number; h: number } | null {
  const s = obj.sizeM ?? obj.size_m;
  if (!s || s.w <= 0 || s.h <= 0) return null;
  return s;
}

function objectBlocksVision(obj: OpcodeMapObject): boolean {
  if (obj.blocksVision === false || obj.blocks_vision === false) return false;
  return true;
}

function objectMaxSsp(obj: OpcodeMapObject): number {
  return obj.maxSsp ?? obj.max_ssp ?? obj.ssp;
}

/** Four edges of a rectangle from top-left start, size, rotation about center. */
export function rectangleSegments(
  objectId: string,
  start: [number, number],
  size: { w: number; h: number },
  rotationDeg: number,
): MapSegmentDto[] {
  const [sx, sy] = start;
  const cx = sx + size.w / 2;
  const cy = sy + size.h / 2;
  const rad = rotationDeg * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const local = [
    { x: -size.w / 2, y: -size.h / 2 },
    { x: size.w / 2, y: -size.h / 2 },
    { x: size.w / 2, y: size.h / 2 },
    { x: -size.w / 2, y: size.h / 2 },
  ];

  const world: Vec2[] = local.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  const segs: MapSegmentDto[] = [];
  for (let i = 0; i < 4; i++) {
    const a = world[i]!;
    const b = world[(i + 1) % 4]!;
    segs.push({
      id: `${objectId}-e${i}`,
      a,
      b,
      armorRating: 0,
      maxSsp: 0,
      currentSsp: 0,
    });
  }
  return segs;
}

function segmentsForObject(objectId: string, obj: OpcodeMapObject): MapSegmentDto[] {
  if (obj.segments?.length) {
    return obj.segments.map((s, i) => ({
      ...s,
      id: s.id || `${objectId}-s${i}`,
      armorRating: s.armorRating ?? obj.ar,
      maxSsp: s.maxSsp ?? objectMaxSsp(obj),
      currentSsp: s.currentSsp ?? obj.ssp,
      blocksVision: s.blocksVision ?? objectBlocksVision(obj),
    }));
  }

  const size = objectSize(obj);
  if (!size) return [];

  const raw = rectangleSegments(objectId, obj.start, size, obj.rotation ?? 0);
  return raw.map(s => ({
    ...s,
    armorRating: obj.ar,
    maxSsp: objectMaxSsp(obj),
    currentSsp: obj.ssp,
    blocksVision: objectBlocksVision(obj),
  }));
}

function normalizeActor(id: string, a: OpcodeMapActorRuntime) {
  return {
    x: a.x,
    y: a.y,
    team: a.team,
    coverId: a.coverId ?? a.cover_id ?? null,
  };
}

/** Compile docs/map.impl.py document → combat geometry. */
export function compileOpcodeMap(doc: OpcodeMapDocument): CompiledCombatMap & OpcodeMapCompileResult {
  const emplacements: CoverEmplacement[] = [];

  let barriers: BallisticBarrier[];
  let solveBounds: MapSolveBounds | null = null;
  let authoredRooms: { id: string; centroid: { x: number; y: number }; cells: { x: number; y: number }[] }[] = [];
  let metersPerUnit: number | undefined;
  let visionRings: Vec2[][] = [];
  let walkRings: Vec2[][] = [];
  const looseWalls: WallSegment[] = [];

  const objects = doc.base.objects;
  if (typeof objects === "string") {
    const mpu = doc.base.metersPerUnit ?? doc.base.meters_per_unit;
    const geom = compileSvgMapGeometry(
      objects,
      mpu !== undefined ? { metersPerUnit: mpu } : undefined,
    );
    barriers = geom.barriers;
    solveBounds = geom.solveBounds;
    authoredRooms = combatRoomsFromRings(geom.roomRings);
    metersPerUnit = geom.metersPerUnit;
    visionRings = geom.visionRings;
    walkRings = geom.walkRings;
  } else {
    barriers = [];
    for (const [objectId, obj] of Object.entries(objects)) {
      if (obj.segments?.length) {
        const segs = segmentsForObject(objectId, obj);
        for (const seg of segs) {
          barriers.push({
            id: seg.id,
            a: seg.a,
            b: seg.b,
            armorRating: seg.armorRating,
            maxSsp: seg.maxSsp,
            currentSsp: seg.currentSsp,
            blocksVision: seg.blocksVision !== false,
          });
          if (seg.blocksVision !== false) looseWalls.push({ a: seg.a, b: seg.b });
        }
        continue;
      }
      const segs = segmentsForObject(objectId, obj);
      for (const seg of segs) {
        barriers.push({
          id: seg.id,
          a: seg.a,
          b: seg.b,
          armorRating: seg.armorRating,
          maxSsp: seg.maxSsp,
          currentSsp: seg.currentSsp,
          blocksVision: seg.blocksVision !== false,
        });
      }
      if (objectBlocksVision(obj) && segs.length >= 3) {
        visionRings.push(segs.map((s) => s.a));
      }
    }
  }

  const emp = doc.base.emplacements ?? {};
  for (const [id, e] of Object.entries(emp)) {
    emplacements.push({
      id,
      emplacement: e.emplacement,
      distanceToEnter: e.distanceToEnter ?? e.distance_to_enter ?? 1,
    });
  }

  const walls: WallSegment[] = bakeWalkWalls([
    ...unionWalkRings(visionRings),
    ...looseWalls,
  ]);
  const navSource = walkRings.length > 0 ? walkRings : visionRings;
  const navWalls: WallSegment[] = bakeWalkWalls([
    ...unionWalkRings(navSource),
    ...looseWalls,
  ]);

  const actors: OpcodeMapCompileResult["actors"] = {};
  for (const [id, a] of Object.entries(doc.runtime?.actors ?? {})) {
    actors[id] = normalizeActor(id, a);
  }

  return {
    mapId: doc.name,
    walls,
    navWalls,
    barriers,
    emplacements,
    solveBounds,
    authoredRooms: authoredRooms.length > 0 ? authoredRooms : undefined,
    metersPerUnit,
    actors,
  };
}
