import type { BallisticBarrier } from "../../combat-ai/geometry.ts";
import { hasLineOfSight, type Vec2, type WallSegment } from "../../combat-ai/visibility.ts";
import { expectedDamagePerHit, plannedTarget } from "../attack-expectation.ts";
import { remainingWeaponRoundsThisRound } from "../fire-mode.ts";
import { localizationHitDifficultyAdd } from "../localization.ts";
import { enteredCoverBlocksRangedShot, mapCoverBandOnLineOfEffect, rangedAttackDifficultyForTarget } from "../ranged-attack-cover.ts";
import { d10HitChance } from "../ranged-attack-roll.ts";
import { rangedAttackMalusParts } from "../standard-action-malus.ts";
import { suppressiveMarginHits } from "../suppressive-fire-resolution.ts";
import type { CombatSnapshot, CombatTargetView } from "../snapshot.ts";

export function suppressiveFireLegal(snapshot: CombatSnapshot): boolean {
  return (snapshot.standardActionsThisRound ?? 0) === 0 && snapshot.metersMovedThisRound === 0 &&
    snapshot.weapon.semiAutoOrBetter && snapshot.ammo.roundsInMagazine > 0 &&
    Math.floor(snapshot.weapon.rateOfFire / 20) >= 1 && remainingWeaponRoundsThisRound(snapshot) > 0;
}

export type SuppressScoreMap = {
  walls: readonly WallSegment[];
  barriers: readonly BallisticBarrier[];
};

export type SuppressiveFireScore = {
  utility: number;
  knownCount: number;
  willHitCount: number;
  expectedHits: number;
  expectedDamage: number;
  remainingAmmo: number;
  coverCount: number;
  localizationAdd: number;
};

/** Exact expectation over the attack die, saves, and the shared ammunition pool. */
export function scoreSuppressiveFire(snapshot: CombatSnapshot, map: SuppressScoreMap, from: Vec2 = snapshot.position): SuppressiveFireScore {
  const score: SuppressiveFireScore = { utility: -Infinity, knownCount: 0, willHitCount: 0, expectedHits: 0, expectedDamage: 0, remainingAmmo: snapshot.ammo.roundsInMagazine, coverCount: 0, localizationAdd: 0 };
  if (!suppressiveFireLegal(snapshot)) return score;
  const known = snapshot.targets.map(view => ({ view, planned: plannedTarget(snapshot, view) }))
    .filter(row => row.planned.localization !== "none");
  score.knownCount = known.length;
  const aim = suppressiveFireAimPoint(from, known.map(row => ({ position: row.planned.position })));
  if (!aim) return score;
  const affected = new Set(suppressiveFireAffectedTargets(from, aim, known.map(row => ({ id: row.view.id, position: row.planned.position })), map.walls, snapshot.weapon.rangeM).map(t => t.id));
  const rows = known.filter(row => affected.has(row.view.id));
  if (rows.some(row => enteredCoverBlocksRangedShot({ shooter: from, target: row.planned.position, shooterCoverId: snapshot.coverId, barriers: map.barriers }))) return score;
  score.willHitCount = rows.length;
  const spent = clampSuppressiveRoundsSpent(snapshot.weapon.rateOfFire, Math.min(snapshot.ammo.roundsInMagazine, remainingWeaponRoundsThisRound(snapshot)));
  score.remainingAmmo = snapshot.ammo.roundsInMagazine - spent;
  const malus = rangedAttackMalusParts({ declaredStandardActions: snapshot.declaredStandardActions ?? 1, priorStandardFiresThisRound: snapshot.standardFiresThisRound ?? 0, roundsThisAction: 1 });
  const targets = rows.map(row => {
    const band = mapCoverBandOnLineOfEffect({ shooter: from, target: row.planned.position, targetEnteredCoverId: row.view.coverId, barriers: map.barriers });
    if (band && band !== "none") score.coverCount++;
    const localization = row.planned.localization === "none" ? "approximate" : row.planned.localization;
    score.localizationAdd += localizationHitDifficultyAdd(localization) / Math.max(1, rows.length);
    return { ...row, difficulty: rangedAttackDifficultyForTarget({ shooter: from, target: row.planned.position, weaponRangeM: snapshot.weapon.rangeM, localization, targetCoverId: row.view.coverId, barriers: map.barriers }).total,
      perHit: expectedDamagePerHit(snapshot, map.barriers, from, row.view, row.planned.position) };
  });
  for (let face = 1; face <= 10; face++) {
    const total = face + (snapshot.attackBonus ?? 0) + malus.unified + malus.consecutiveFire;
    let ammunition = new Array<number>(spent + 1).fill(0);
    ammunition[spent] = 1;
    for (const row of targets) {
      // Unknown defense uses the observer's own defense, not hidden target stats.
      const save = d10HitChance(row.view.reflexSaveBonus ?? snapshot.reflexSaveBonus ?? 0, total);
      const next = new Array<number>(spent + 1).fill(0);
      for (let left = 0; left <= spent; left++) {
        const probability = ammunition[left]!;
        if (!probability) continue;
        if (left === 0) { next[0] += probability; continue; }
        next[left] += probability * save;
        for (let die = 1; die <= left; die++) {
          const hits = Math.min(left, Math.min(die, suppressiveMarginHits(total, row.difficulty)));
          const weight = probability * (1 - save) / left;
          next[left - hits] += weight;
          score.expectedHits += weight * hits / 10;
          score.expectedDamage += weight * hits * row.perHit * (face === 10 && row.view.healthMode !== "normal" ? 2 : 1) / 10;
        }
      }
      ammunition = next;
    }
  }
  score.utility = score.expectedDamage;
  return score;
}

export function suppressiveFireUtility(snapshot: CombatSnapshot, map: SuppressScoreMap, from: Vec2 = snapshot.position): number {
  return scoreSuppressiveFire(snapshot, map, from).utility;
}

export function formatAttackChoiceReason(input: { chosen: "standard_fire" | "suppressive_fire" | "throw"; suppress: SuppressiveFireScore; bestFire: number }): string {
  const label = { standard_fire: "直射", suppressive_fire: "火压", throw: "投掷" }[input.chosen];
  const fire = Number.isFinite(input.bestFire) ? input.bestFire.toFixed(1) : "不可用";
  const suppress = Number.isFinite(input.suppress.utility) ? input.suppress.expectedDamage.toFixed(1) : "不可用";
  return `选择 ${label}：预期伤害 直射${fire} / 火压${suppress} · 火压预期命中${input.suppress.expectedHits.toFixed(1)}发，范围内${input.suppress.willHitCount}人，剩弹${input.suppress.remainingAmmo}`;
}

export function suppressiveFireRoundsSpent(rateOfFire: number): number {
  return Math.max(1, Math.floor(rateOfFire / 20));
}

export function clampSuppressiveRoundsSpent(rateOfFire: number, roundsInMagazine: number): number {
  return Math.min(Math.max(0, roundsInMagazine), suppressiveFireRoundsSpent(rateOfFire));
}

export function describeSuppressiveFireAmmo(spent: number, remaining: number): string {
  return `压制 耗弹${spent} 剩${remaining}`;
}

/** Width of the aimed patch at the focus (m); sector edges are tangent rays from the shooter. */
export const SUPPRESSIVE_FIRE_RADIUS_M = 5;

const TAU = Math.PI * 2;
const EPS = 1e-9;

function normalizeBearing(rad: number): number {
  return ((rad % TAU) + TAU) % TAU;
}

/** Smallest angle between two bearings (rad). */
export function bearingSeparation(a: number, b: number): number {
  let d = Math.abs(normalizeBearing(a) - normalizeBearing(b));
  if (d > Math.PI) d = TAU - d;
  return d;
}

/** Half-width of the suppressive sector covering a disk of radiusM centered on aim. */
export function suppressiveFireSectorHalfAngle(
  from: Vec2,
  aim: Vec2,
  radiusM = SUPPRESSIVE_FIRE_RADIUS_M,
): number {
  const d = Math.hypot(aim.x - from.x, aim.y - from.y);
  if (d <= radiusM + EPS) return Math.PI;
  return Math.asin(Math.min(1, radiusM / d));
}

export function suppressiveFireAimPoint(
  from: Vec2,
  targets: readonly Pick<CombatTargetView, "position">[],
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const target of targets) {
    const d = Math.hypot(target.position.x - from.x, target.position.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = target.position;
    }
  }
  return best ? { ...best } : null;
}

/** True when point lies in the wedge from shooter through the aim patch (vision walls block). */
export function pointInSuppressiveFireArea(
  from: Vec2,
  aim: Vec2,
  point: Vec2,
  walls: readonly WallSegment[],
  maxRangeM: number,
  radiusM = SUPPRESSIVE_FIRE_RADIUS_M,
): boolean {
  const dx = point.x - from.x;
  const dy = point.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist > maxRangeM + EPS || dist <= EPS) return false;
  const centerBearing = Math.atan2(aim.y - from.y, aim.x - from.x);
  const pointBearing = Math.atan2(dy, dx);
  if (bearingSeparation(centerBearing, pointBearing) > suppressiveFireSectorHalfAngle(from, aim, radiusM) + EPS) {
    return false;
  }
  return hasLineOfSight(from, point, walls);
}

export function suppressiveFireAffectedTargets(
  from: Vec2,
  aim: Vec2,
  targets: readonly Pick<CombatTargetView, "id" | "position">[],
  walls: readonly WallSegment[],
  maxRangeM: number,
  radiusM = SUPPRESSIVE_FIRE_RADIUS_M,
): { id: string; position: Vec2 }[] {
  return targets
    .filter((t) => pointInSuppressiveFireArea(from, aim, t.position, walls, maxRangeM, radiusM))
    .map((t) => ({ id: t.id, position: { ...t.position } }));
}
