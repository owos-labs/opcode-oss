import type { CoverHeightBand } from "../combat-ai/cover-concealment-view.ts";
import { rayCoverHitT } from "../combat-ai/cover.ts";
import {
  closestPointOnSegment,
  orderedBarrierHits,
  type BallisticBarrier,
  type Vec2,
} from "../combat-ai/geometry.ts";
import type { CombatLocalizationLevel } from "../combat-ai/cover-concealment-view.ts";
import { coverHeightHitDifficultyAdd } from "./cover-height.ts";
import {
  localizationHitDifficultyAdd,
  targetCoverHitDifficultyAdd,
} from "./localization.ts";
import { rangeBandDifficulty } from "./range-difficulty.ts";

/** Map cover benefit radius for units not using enter_cover (m). */
export const MAP_COVER_BENEFIT_RADIUS_M = 3;

const EPS = 1e-9;

export function isWithinMapCoverBenefitRadius(
  point: Vec2,
  barrier: { a: Vec2; b: Vec2 },
  radiusM = MAP_COVER_BENEFIT_RADIUS_M,
): boolean {
  const closest = closestPointOnSegment(point, barrier);
  const dx = closest.x - point.x;
  const dy = closest.y - point.y;
  return dx * dx + dy * dy <= radiusM * radiusM + EPS;
}

/** Entered cover (enter_cover): cannot shoot targets on the far side of that barrier. */
export function enteredCoverBlocksRangedShot(input: {
  shooterCoverId: string | null;
  shooter: Vec2;
  target: Vec2;
  barriers: readonly BallisticBarrier[];
}): boolean {
  if (!input.shooterCoverId) return false;
  const cover = input.barriers.find((b) => b.id === input.shooterCoverId);
  if (!cover) return false;
  return rayCoverHitT(input.shooter, input.target, cover) !== null;
}

/** Permanent map cover on LOF when the defender is within 3m and did not enter cover. */
export function mapCoverBandOnLineOfEffect(input: {
  shooter: Vec2;
  target: Vec2;
  targetEnteredCoverId: string | null;
  barriers: readonly BallisticBarrier[];
  benefitRadiusM?: number;
}): CoverHeightBand | undefined {
  if (input.targetEnteredCoverId) return undefined;
  const radius = input.benefitRadiusM ?? MAP_COVER_BENEFIT_RADIUS_M;
  const hits = orderedBarrierHits(input.shooter, input.target, input.barriers);
  let best: CoverHeightBand | undefined;
  let bestAdd = 0;
  for (const hit of hits) {
    const barrier = input.barriers.find((b) => b.id === hit.barrierId);
    const band = barrier?.coverHeightBand;
    if (!band || band === "none") continue;
    if (!barrier || !isWithinMapCoverBenefitRadius(input.target, barrier, radius)) continue;
    const add = coverHeightHitDifficultyAdd(band);
    if (add > bestAdd) {
      bestAdd = add;
      best = band;
    }
  }
  return best;
}

export function degradeLocalization(level: CombatLocalizationLevel): CombatLocalizationLevel {
  if (level === "full") return "exact";
  if (level === "exact") return "approximate";
  return "approximate";
}

/** Target entered cover and LOF crosses their emplacement — full concealment modifiers. */
export function targetEnteredCoverOnLineOfEffect(
  shooter: Vec2,
  target: Vec2,
  targetCoverId: string | null,
  barriers: readonly BallisticBarrier[],
): boolean {
  if (!targetCoverId) return false;
  const cover = barriers.find((b) => b.id === targetCoverId);
  if (!cover) return false;
  return rayCoverHitT(shooter, target, cover) !== null;
}

const LOCALIZATION_TIER_STEP = 5;

export function rangedAttackDifficultyForTarget(input: {
  shooter: Vec2;
  target: Vec2;
  weaponRangeM: number;
  localization: CombatLocalizationLevel;
  targetCoverId: string | null;
  barriers: readonly BallisticBarrier[];
}): {
  total: number;
  range: number;
  localization: number;
  cover: number;
  effectiveLocalization: CombatLocalizationLevel;
} {
  const dist = Math.hypot(input.target.x - input.shooter.x, input.target.y - input.shooter.y);
  const range = rangeBandDifficulty(dist, input.weaponRangeM);

  let effectiveLocalization = input.localization;
  let localization = localizationHitDifficultyAdd(effectiveLocalization);
  let cover = 0;

  if (
    targetEnteredCoverOnLineOfEffect(
      input.shooter,
      input.target,
      input.targetCoverId,
      input.barriers,
    )
  ) {
    effectiveLocalization = degradeLocalization(effectiveLocalization);
    localization = localizationHitDifficultyAdd(effectiveLocalization) + LOCALIZATION_TIER_STEP;
    const band = input.barriers.find((b) => b.id === input.targetCoverId)?.coverHeightBand;
    cover = targetCoverHitDifficultyAdd(band);
  } else {
    const band = mapCoverBandOnLineOfEffect({
      shooter: input.shooter,
      target: input.target,
      targetEnteredCoverId: input.targetCoverId,
      barriers: input.barriers,
    });
    cover = targetCoverHitDifficultyAdd(band);
  }

  return {
    total: range + localization + cover,
    range,
    localization,
    cover,
    effectiveLocalization,
  };
}
