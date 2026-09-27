import type { CoverHeightBand } from "../combat-ai/cover-concealment-view.ts";

/**
 * SVG cover-height fraction → band (docs/map.impl.py).
 * 1 full, 0.75 two-thirds, 0.5 half, 0.2 leg.
 */
export function coverHeightBandFromFraction(fraction: number): CoverHeightBand {
  const f = fraction;
  if (f >= 0.9) return "full";
  if (f >= 0.7) return "two_thirds";
  if (f >= 0.4) return "half";
  if (f >= 0.15) return "leg";
  return "none";
}

/** 1.7 cover height difficulty adders (does not stack with target size). */
export function coverHeightHitDifficultyAdd(band: CoverHeightBand): number {
  switch (band) {
    case "leg":
      return 1;
    case "third":
      return 2;
    case "two_thirds":
      return 2;
    case "half":
      return 3;
    case "full":
      return 5;
    default:
      return 0;
  }
}
