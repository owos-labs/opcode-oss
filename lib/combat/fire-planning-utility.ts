import { expectedArmorPenetration, armorPenetrationDamageFactor } from "../combat-ai/armor-penetration.ts";
import { canDifficultyFireAtLoc } from "../combat-ai/combat-policy.ts";
import { getNpcDifficultyProfile } from "../combat-ai/difficulty.ts";
import { orderedBarrierHits } from "../combat-ai/geometry.ts";
import {
  plannedTarget,
  standardFireExpectation,
} from "./attack-expectation.ts";
import { resolveBallisticToTarget } from "./ballistic.ts";
import { localizationHitDifficultyAdd } from "./localization.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import { rangeBandDifficulty, rangeUtilityPenalty } from "./range-difficulty.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";

function coverOpts(snapshot: CombatSnapshot): { canPenCover: boolean; grenade: boolean } {
  return {
    canPenCover: snapshot.weapon.canPenCover === true,
    grenade: snapshot.throwable !== undefined,
  };
}

/** Ballistic reach score without hit roll — planning floor when expectation is zero. */
export function ballisticFireReachUtility(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  from: { x: number; y: number },
  view: CombatTargetView,
): number {
  const profile = getNpcDifficultyProfile(snapshot.encounter.profileId);
  const target = plannedTarget(snapshot, view);
  const dist = Math.hypot(target.position.x - from.x, target.position.y - from.y);
  const rangeDiff = rangeBandDifficulty(dist, snapshot.weapon.rangeM);
  const locDiff =
    target.localization === "none" ? 0 : localizationHitDifficultyAdd(target.localization);
  const hits = orderedBarrierHits(from, target.position, map.barriers);
  const ballistic = resolveBallisticToTarget(
    snapshot.ammo.penetration,
    snapshot.ammo.expectedDamageDice,
    hits,
  );
  if (!ballistic.reachesTarget && profile.considersCover) return -Infinity;
  const pen = expectedArmorPenetration({
    profile,
    ammoPenetration: ballistic.remainingPenetration,
    targetArmor: view.armorByPart,
  });
  const penFactor = armorPenetrationDamageFactor(pen);
  return (
    ballistic.expectedDamageDice * penFactor * 3 -
    rangeUtilityPenalty(rangeDiff) * 10 -
    locDiff * 0.15 +
    snapshot.weapon.accuracy * 0.1
  );
}

/** Expectation when it matters; ballistic floor when hits are unlikely but the shot still reaches. */
export function firePlanningUtility(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  from: { x: number; y: number },
  view: CombatTargetView,
): number {
  const planned = plannedTarget(snapshot, view);
  if (!canDifficultyFireAtLoc(snapshot.encounter.profileId, planned.localization, coverOpts(snapshot))) {
    return -Infinity;
  }

  const expected = standardFireExpectation(snapshot, map.barriers, from, view);
  if (expected.damage > 0) return expected.damage;

  const clean = standardFireExpectation(
    {
      ...snapshot,
      declaredStandardActions: 1,
      declaredStandardFires: 1,
      standardFiresThisRound: 0,
    },
    map.barriers,
    from,
    view,
    1,
  );
  if (clean.damage > 0) return expected.damage;

  const reach = ballisticFireReachUtility(snapshot, map, from, view);
  return reach > 0 ? reach : 0;
}
