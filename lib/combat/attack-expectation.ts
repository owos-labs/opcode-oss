import { armorRatingForPart } from "../combat-ai/armor-penetration.ts";
import { canDifficultyFireAtLoc } from "../combat-ai/combat-policy.ts";
import type { BallisticBarrier } from "../combat-ai/geometry.ts";
import { hasLineOfSight, type Vec2 } from "../combat-ai/visibility.ts";
import { armorAdjustedDamageDice } from "./armor-penetration-damage.ts";
import { combatBallisticHits, resolveBallisticToTarget } from "./ballistic.ts";
import { OPCODE_HEALTH_PARTS, type OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import { EMPTY_OPCODE_VITALS } from "../character-sheets/opcode-health-vitals.ts";
import { opcodeHitPartFromD10 } from "./bench-health-damage.ts";
import { expectedOpcodeDamage } from "./damage-roll.ts";
import {
  expectedExplosiveNormalDamage,
  expectedNormalDamageUtility,
  expectedNormalHitOnPart,
  opcodePartsFromBenchParts,
  type OpcodePartRuntime,
} from "./opcode-part-health.ts";
import {
  chooseFireMode,
  hitsForStandardFire,
  planStandardFire,
  type StandardFirePlanOpts,
} from "./fire-mode.ts";
import { readProjectedIntel } from "./localization.ts";
import { enteredCoverBlocksRangedShot, rangedAttackDifficultyForTarget } from "./ranged-attack-cover.ts";
import { rangedAttackMalusParts } from "./standard-action-malus.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";

export function standardFirePlanOptsForView(
  snapshot: CombatSnapshot,
  barriers: readonly BallisticBarrier[],
  from: Vec2,
  view: CombatTargetView,
  distanceM: number,
  declared = snapshot.declaredStandardActions ?? 1,
  resolvedTarget?: ReturnType<typeof plannedTarget>,
): StandardFirePlanOpts {
  const target = resolvedTarget ?? plannedTarget(snapshot, view);
  const mode = chooseFireMode(snapshot, distanceM);
  const difficulty = rangedAttackDifficultyForTarget({
    shooter: from,
    target: target.position,
    weaponRangeM: snapshot.weapon.rangeM,
    localization: target.localization === "none" ? "approximate" : target.localization,
    targetCoverId: view.coverId,
    barriers,
  }).total;
  const malus = rangedAttackMalusParts({
    declaredStandardActions: declared,
    declaredStandardFiresInRound: snapshot.declaredStandardFires ?? declared,
    priorStandardFiresThisRound: snapshot.standardFiresThisRound ?? 0,
    fireMode: mode,
  });
  return {
    attackBonus: snapshot.attackBonus ?? 0,
    attackMalus: malus.unified + malus.consecutiveFire,
    hitDifficulty: difficulty,
  };
}

export function plannedTarget(snapshot: CombatSnapshot, view: CombatTargetView) {
  if (!snapshot.intel || !snapshot.factionId) return { localization: view.localization, position: view.position };
  const intel = readProjectedIntel(snapshot.intel, snapshot.factionId, view.id, snapshot.encounter.profileId, view.position);
  return {
    localization: intel.level,
    position: intel.level === "full" || intel.level === "exact"
      ? intel.lastKnownPosition ?? view.position : intel.fuzzyReportPoint ?? view.position,
  };
}

function viewNormalParts(view: CombatTargetView): Record<OpcodeHealthPart, OpcodePartRuntime> | null {
  if (view.healthMode !== "normal" || !view.parts) return null;
  const merged = {} as Record<
    OpcodeHealthPart,
    { current: number; max: number; destroyed?: boolean; severed?: boolean }
  >;
  for (const key of OPCODE_HEALTH_PARTS) {
    const row = view.parts[key];
    if (!row) return null;
    merged[key] = row;
  }
  return opcodePartsFromBenchParts(merged);
}

function meanDamageForPart(
  snapshot: CombatSnapshot,
  ballistic: ReturnType<typeof resolveBallisticToTarget>,
  expr: string,
  view: CombatTargetView,
  part: OpcodeHealthPart,
): number {
  const armor = armorAdjustedDamageDice({
    baseDice: ballistic.expectedDamageDice,
    penetrationMargin:
      ballistic.remainingPenetration - armorRatingForPart(view.armorByPart, part),
  });
  return expectedOpcodeDamage(
    expr,
    armor.maxDice,
    armor.kind === "under" ? 1 : 0,
  );
}

/** Mean combat utility for one hit (pool, head kill, incap) aligned with bench resolution. */
export function expectedDamagePerHit(snapshot: CombatSnapshot, barriers: readonly BallisticBarrier[], from: Vec2, view: CombatTargetView, aimAt = view.position): number {
  const ballistic = resolveBallisticToTarget(snapshot.ammo.penetration, snapshot.ammo.expectedDamageDice, combatBallisticHits(from, aimAt, barriers));
  if (!ballistic.reachesTarget || ballistic.expectedDamageDice <= 0) return 0;
  const expr = snapshot.ammo.damageDiceExpr?.trim() || `${ballistic.expectedDamageDice}d6`;
  const parts = viewNormalParts(view);
  const maxHp =
    view.maxHp ??
    (parts
      ? OPCODE_HEALTH_PARTS.reduce((sum, key) => sum + parts[key].max, 0)
      : 20);

  if (parts) {
    const vitals = view.vitals ?? EMPTY_OPCODE_VITALS;
    const stats = view.saveStats;
    if (snapshot.ammo.explosive) {
      const meanTotal = expectedOpcodeDamage(
        expr,
        ballistic.expectedDamageDice,
        0,
      );
      const outcome = expectedExplosiveNormalDamage(parts, vitals, meanTotal, stats);
      return expectedNormalDamageUtility(outcome, maxHp);
    }
    let utility = 0;
    for (let face = 1; face <= 10; face++) {
      const part = opcodeHitPartFromD10(face);
      const mean = meanDamageForPart(snapshot, ballistic, expr, view, part);
      const outcome = expectedNormalHitOnPart(parts, vitals, part, mean, stats);
      utility += expectedNormalDamageUtility(outcome, maxHp) / 10;
    }
    return utility;
  }

  let mean = 0;
  for (let face = 1; face <= 10; face++) {
    const part = view.healthMode === "normal" ? opcodeHitPartFromD10(face) : "torso";
    mean += meanDamageForPart(snapshot, ballistic, expr, view, part) / 10;
  }
  return mean;
}

export function standardFireExpectation(snapshot: CombatSnapshot, barriers: readonly BallisticBarrier[], from: Vec2, view: CombatTargetView, declared = snapshot.declaredStandardActions ?? 1) {
  const target = plannedTarget(snapshot, view);
  const moved =
    Math.hypot(from.x - snapshot.position.x, from.y - snapshot.position.y) > 1e-6;
  // Only project a moved observer's sight of the reported point, never the hidden true position.
  if (target.localization === "exact" && moved && snapshot.visionRangeM != null) {
    const inVision =
      Math.hypot(from.x - target.position.x, from.y - target.position.y) <=
        snapshot.visionRangeM &&
      hasLineOfSight(from, target.position, barriers.filter((b) => b.blocksVision));
    if (inVision) target.localization = "full";
    else return { hitProbability: 0, expectedHits: 0, damage: 0 };
  }
  const empty = { hitProbability: 0, expectedHits: 0, damage: 0 };
  if (!canDifficultyFireAtLoc(snapshot.encounter.profileId, target.localization, { canPenCover: snapshot.weapon.canPenCover === true, grenade: snapshot.throwable !== undefined })) return empty;
  if (enteredCoverBlocksRangedShot({ shooter: from, target: target.position, shooterCoverId: snapshot.coverId, barriers })) return empty;
  const distanceM = Math.hypot(target.position.x - from.x, target.position.y - from.y);
  const planOpts = standardFirePlanOptsForView(
    snapshot,
    barriers,
    from,
    view,
    distanceM,
    declared,
    target,
  );
  const fire = planStandardFire(snapshot, distanceM, () => 0, planOpts);
  if (!fire.rounds || target.localization === "none") return empty;
  const difficulty = planOpts.hitDifficulty!;
  const malus = rangedAttackMalusParts({
    declaredStandardActions: declared,
    declaredStandardFiresInRound: snapshot.declaredStandardFires ?? declared,
    priorStandardFiresThisRound: snapshot.standardFiresThisRound ?? 0,
    fireMode: fire.mode,
  });
  const bonus =
    (snapshot.attackBonus ?? 0) +
    malus.unified +
    malus.consecutiveFire -
    (fire.mode === "auto" ? fire.walkFirePenalty : 0);
  const perHit = expectedDamagePerHit(snapshot, barriers, from, view, target.position);
  let damage = 0, expectedHits = 0, hitProbability = 0;
  for (let face = 1; face <= 10; face++) {
    const hits = hitsForStandardFire({ mode: fire.mode, attackTotal: face + bonus, difficulty, rounds: fire.rounds, walkFirePenalty: fire.walkFirePenalty });
    if (hits > 0) hitProbability += 0.1;
    expectedHits += hits / 10;
    damage += hits * perHit * (face === 10 && view.healthMode !== "normal" ? 2 : 1) / 10;
  }
  return { hitProbability: Math.min(1, hitProbability), expectedHits, damage };
}
