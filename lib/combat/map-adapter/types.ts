import type { Vec2 } from "../../combat-ai/visibility.ts";

export type MapSegmentDto = {
  id: string;
  a: Vec2;
  b: Vec2;
  blocksVision?: boolean;
  armorRating: number;
  maxSsp: number;
  currentSsp: number;
  thicknessCm?: number;
};

export type MapEmplacementDto = {
  id: string;
  emplacement: "half_body" | "full_body";
  distanceToEnter: number;
};

export type CombatMapDto = {
  id: string;
  segments: MapSegmentDto[];
  emplacements?: MapEmplacementDto[];
};
