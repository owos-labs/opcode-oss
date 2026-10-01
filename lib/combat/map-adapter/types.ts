import type { CoverHeightBand } from "../../combat-ai/cover-concealment-view.ts";
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
  /** From SVG cover-height. Half/leg/2/3 are cover, not room walls. */
  coverHeightBand?: CoverHeightBand;
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
