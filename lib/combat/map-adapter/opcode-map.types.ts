import type { MapEmplacementDto, MapSegmentDto } from "./types.ts";

/** Legacy object proxy (size_m / segments); prefer base.objects SVG string. */
export type OpcodeMapSizeM = { w: number; h: number };

export type OpcodeMapObject = {
  name?: string;
  ar: number;
  ssp: number;
  maxSsp?: number;
  max_ssp?: number;
  blocksVision?: boolean;
  blocks_vision?: boolean;
  start: [number, number];
  rotation?: number;
  sizeM?: OpcodeMapSizeM;
  size_m?: OpcodeMapSizeM;
  segments?: MapSegmentDto[];
};

export type OpcodeMapEmplacement = {
  emplacement: "half_body" | "full_body";
  distanceToEnter?: number;
  distance_to_enter?: number;
  anchor?: [number, number];
};

export type OpcodeMapActorRuntime = {
  x: number;
  y: number;
  team?: string;
  coverId?: string | null;
  cover_id?: string | null;
};

/** docs/map.impl.py — base.objects is authoritative SVG when a string. */
export type OpcodeMapDocument = {
  name: string;
  base: {
    objects: string | Record<string, OpcodeMapObject>;
    meters_per_unit?: number;
    metersPerUnit?: number;
    emplacements?: Record<string, OpcodeMapEmplacement>;
  };
  runtime?: {
    actors?: Record<string, OpcodeMapActorRuntime>;
  };
};

export type OpcodeMapCompileResult = {
  mapId: string;
  actors: Record<string, { x: number; y: number; team?: string; coverId: string | null }>;
};
