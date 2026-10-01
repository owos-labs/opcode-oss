import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  type ActionFeasibilityShape,
  type ActionFeasibilityTensor,
} from "../combat-ai/action-feasibility.ts";
import { closestPointOnSegment } from "../combat-ai/geometry.ts";
import { rayCoverHitT } from "../combat-ai/cover.ts";
import { hasLineOfSight } from "../combat-ai/visibility.ts";
import {
  allowsThrowOrSuppress,
  canDeclareUnlocatedAmbush,
  concealWhenExpectedKilled,
  canDifficultyFireAtLoc,
  hitExpectedPositive,
  isThrowOrSuppressLegalForFuzzy,
  locatedPathAmbushPolicy,
  maxStandardActionsThisRound,
  preferredAimPlan,
  suppressiveFirePlanningUtility,
  type PolicyLocLevel,
} from "../combat-ai/combat-policy.ts";
import { getNpcDifficultyProfile } from "../combat-ai/difficulty.ts";
import { stancesFromWalkCosts, type TacticalStance } from "../combat-ai/geometry.ts";
import { suppressiveFireLegal, suppressiveFireUtility } from "./actions/suppressive-action.ts";
import { throwActionLegal, throwActionUtility } from "./actions/throw-action.ts";
import {
  expectedDamagePerHit,
  plannedTarget as planningTarget,
  standardFireExpectation,
  standardFirePlanOptsForView,
} from "./attack-expectation.ts";
import { d10HitChance } from "./ranged-attack-roll.ts";
import { rangedAttackDifficultyForTarget } from "./ranged-attack-cover.ts";
import { maxStandardActionsInRound } from "./initiative.ts";
import {
  locRank,
  readProjectedIntel,
  type IntelLocLevel,
} from "./localization.ts";
import type { MapSolveBounds } from "./map-adapter/compile-svg-map.ts";
import { combatMapWalkWalls, type CompiledCombatMap } from "./map-adapter/compile.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import { expandVisibilityWalk, expandWalkCosts, walkCostViaNodes, walkPath, pointAlongPolyline, type WalkRoute } from "../combat-ai/walk-path.ts";

import { mapCoverBandOnLineOfEffect } from "./ranged-attack-cover.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";
import { firePlanningUtility } from "./fire-planning-utility.ts";
import { applyStandardFireToSnapshot, planStandardFire } from "./fire-mode.ts";

export type PlanningPayload = {
  shape: ActionFeasibilityShape;
  feasibility: ActionFeasibilityTensor;
  utility: Float32Array;
  /** Stance index → world position (0 = snapshot.position). */
  stancePositions: readonly { x: number; y: number }[];
  /** Vision walls used to price moves by walked path, not Euclidean. */
  walls?: readonly { a: { x: number; y: number }; b: { x: number; y: number } }[];
  /** Target index → target id (0 = none). */
  targetIds: readonly (string | null)[];
  barrierVersion: number;
  sustainedFireToken: number;
  maxStandardActions: number;
  locatedPathConditional: boolean;
  coverIds?: readonly (string | null)[];
  movementReason?: string;
  disengaging?: boolean;
  /** True when a broken-contact bot should hold, not re-enter or keep fleeing. */
  holdingDisengage?: boolean;
  favorableReentry?: boolean;
};

/** One incoming attack per known hostile; unknown weapons use the observer's weapon estimate. */
function incomingDamage(snapshot: CombatSnapshot, map: CompiledCombatMap, from: { x: number; y: number }): number {
  let damage = 0;
  const coverId = from.x === snapshot.position.x && from.y === snapshot.position.y ? snapshot.coverId : null;
  for (const enemy of snapshot.targets) {
    const planned = planningTarget(snapshot, enemy);
    if (planned.localization === "none") continue;
    const source = { ...snapshot, ammo: snapshot.ammo, weapon: { ...snapshot.weapon, rangeM: enemy.weaponRangeM ?? snapshot.weapon.rangeM } };
    const defender: CombatTargetView = {
      id: snapshot.actorId,
      position: from,
      localization: "full",
      armorByPart: snapshot.armorByPart ?? {},
      coverId,
      healthMode: snapshot.healthMode,
      maxHp: snapshot.maxHp,
      parts: snapshot.parts,
      vitals: snapshot.vitals,
      saveStats: snapshot.saveStats,
    };
    const perHit = expectedDamagePerHit(source, map.barriers, planned.position, defender);
    const ownWeaponMean = expectedDamagePerHit(source, [], planned.position, { ...defender, armorByPart: {} });
    const scale = enemy.damagePerHit !== undefined && ownWeaponMean > 0 ? enemy.damagePerHit / ownWeaponMean : 1;
    const difficulty = rangedAttackDifficultyForTarget({ shooter: planned.position, target: from, weaponRangeM: source.weapon.rangeM,
      localization: hasLineOfSight(planned.position, from, map.walls) ? "full" : "exact", targetCoverId: coverId, barriers: map.barriers }).total;
    const bonus = enemy.attackBonus ?? snapshot.attackBonus ?? 0;
    const crit = snapshot.healthMode !== "normal" && bonus + 10 >= difficulty ? 0.1 : 0;
    damage += (d10HitChance(bonus, difficulty) + crit) * perHit * scale;
  }
  return damage / Math.max(1, snapshot.allyCount ?? 1);
}

function coverOpts(snapshot: CombatSnapshot): { canPenCover: boolean; grenade: boolean } {
  return {
    canPenCover: snapshot.weapon.canPenCover === true,
    grenade: snapshot.throwable !== undefined,
  };
}

function pointInSolveBounds(p: { x: number; y: number }, bounds: MapSolveBounds | null | undefined): boolean {
  if (!bounds) return true;
  return (
    p.x >= bounds.min.x &&
    p.x <= bounds.max.x &&
    p.y >= bounds.min.y &&
    p.y <= bounds.max.y
  );
}

function buildStances(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  extraPositions: readonly { x: number; y: number }[] = [],
): TacticalStance[] {
  const budget = remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound);
  const inBounds = map.solveBounds
    ? (p: { x: number; y: number }) => pointInSolveBounds(p, map.solveBounds)
    : undefined;
  const origin = snapshot.position;
  const walls = combatMapWalkWalls(map);
  const vis = expandVisibilityWalk(origin, walls, budget);
  const extras = stancesFromWalkCosts(expandWalkCosts(origin, walls, budget, 1, 16, vis), {
    movBudget: budget,
    maxStances: 15,
    inBounds,
  });
  const coverPoints: { x: number; y: number }[] = [];
  const hostiles = snapshot.targets.map(t => planningTarget(snapshot, t)).filter(t => t.localization !== "none");
  for (const barrier of map.barriers) {
    if (barrier.coverHeightBand === "none" || (!barrier.coverHeightBand && !barrier.blocksVision)) continue;
    const near = closestPointOnSegment(origin, barrier);
    if (Math.hypot(near.x - origin.x, near.y - origin.y) > budget + 1) continue;
    const length = Math.hypot(barrier.b.x - barrier.a.x, barrier.b.y - barrier.a.y);
    if (length < 1e-6) continue;
    const nx = -(barrier.b.y - barrier.a.y) / length * 0.5;
    const ny = (barrier.b.x - barrier.a.x) / length * 0.5;
    for (const p of [near, { x: (barrier.a.x + barrier.b.x) / 2, y: (barrier.a.y + barrier.b.y) / 2 },
      { x: barrier.a.x * 0.95 + barrier.b.x * 0.05, y: barrier.a.y * 0.95 + barrier.b.y * 0.05 },
      { x: barrier.a.x * 0.05 + barrier.b.x * 0.95, y: barrier.a.y * 0.05 + barrier.b.y * 0.95 }]) {
      for (const side of [-1, 1]) {
        const candidate = { x: p.x + nx * side, y: p.y + ny * side };
        if (hostiles.some(t => rayCoverHitT(t.position, candidate, barrier) !== null)) coverPoints.push(candidate);
      }
    }
  }
  coverPoints.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
  const seen = new Set(extras.map(s => `${s.position.x.toFixed(3)},${s.position.y.toFixed(3)}`));
  // ponytail: at most 24 reachable cover candidates; spatial indexing if dense maps need more.
  let coverCount = 0;
  for (const p of [...extraPositions, ...coverPoints]) {
    if (coverPoints.includes(p) && coverCount >= 24) break;
    if (inBounds && !inBounds(p)) continue;
    const cost = walkCostViaNodes(origin, p, vis, walls, budget);
    if (cost == null || cost < 1e-6 || cost > budget + 1e-6) continue;
    const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    extras.push({ id: extras.length + 1, position: { x: p.x, y: p.y }, cost });
    if (coverPoints.includes(p)) coverCount++;
  }
  return extras;
}

function asPolicyLoc(level: IntelLocLevel): PolicyLocLevel {
  return level;
}

/** 空过：原地无有效射击且存在绕侧/掩体还击位时不应空过。 */
const PASS_TURN_UTILITY_PENALTY = 2;
/** 绕侧：移动后伤害期望高于当前位。 */
const REPOSITION_FIRE_BONUS_SCALE = 1;
/** 重新找有视野的掩体：从无掩体进入可还击掩体。 */
const COVERED_FIRE_UTILITY_BONUS = 3;

export function bestStandardFireUtility(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  from: { x: number; y: number } = snapshot.position,
): number {
  let best = -Infinity;
  for (let target = 1; target <= snapshot.targets.length; target++) {
    best = Math.max(best, fireUtility(snapshot, map, from, target));
  }
  return best;
}

function fireUtility(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  from: { x: number; y: number },
  targetIndex: number,
): number {
  const view = snapshot.targets[targetIndex - 1];
  if (!view) return -Infinity;
  return firePlanningUtility(snapshot, map, from, view);
}

function highestHostileLoc(snapshot: CombatSnapshot): PolicyLocLevel {
  let best: IntelLocLevel = "none";
  for (const view of snapshot.targets) {
    const planned = planningTarget(snapshot, view);
    if (locRank(planned.localization) > locRank(best)) best = planned.localization;
  }
  return asPolicyLoc(best);
}

function hasLocatedPath(snapshot: CombatSnapshot): boolean {
  if (snapshot.locatedPathAmbush) return true;
  if (!snapshot.intel || !snapshot.factionId) return false;
  for (const view of snapshot.targets) {
    const projected = readProjectedIntel(
      snapshot.intel,
      snapshot.factionId,
      view.id,
      snapshot.encounter.profileId,
      view.position,
    );
    if (
      (projected.level === "exact" || projected.level === "full") &&
      projected.movementTrack
    ) {
      return true;
    }
  }
  return false;
}

function throwLegalForTarget(
  snapshot: CombatSnapshot,
  loc: IntelLocLevel,
  rng: () => number,
  locatedPathConditional: boolean,
): boolean {
  const difficulty = snapshot.encounter.profileId;
  if (!throwActionLegal(snapshot) || !allowsThrowOrSuppress(difficulty)) return false;
  if (locatedPathConditional && !locatedPathAmbushPolicy(difficulty).allowThrowSuppress) return false;
  if (loc === "none") return false;
  if (difficulty === "novice" && loc !== "full") return false;
  if (loc === "approximate") return isThrowOrSuppressLegalForFuzzy(difficulty, rng);
  return true;
}

export function buildPlanningPayload(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  rng: () => number = () => 1,
  extraStances: readonly { x: number; y: number }[] = [],
): PlanningPayload {
  const difficulty = snapshot.encounter.profileId;
  const wantsCover = getNpcDifficultyProfile(difficulty).considersCover;
  const opts = coverOpts(snapshot);
  const plannedLocs = snapshot.targets.map(t => planningTarget(snapshot, t));
  const hostileCount = plannedLocs.filter(p => p.localization !== "none").length;
  const hereFire = Math.max(0, ...snapshot.targets.map(t => standardFireExpectation(snapshot, map.barriers, snapshot.position, t).damage));
  const passProbability = Math.max(0, ...snapshot.targets.map(t => standardFireExpectation(snapshot, map.barriers, snapshot.position, t).hitProbability));
  const hitEvPositive = hitExpectedPositive({ difficulty, passProbability, expectedDamageDice: snapshot.ammo.expectedDamageDice, hostileCount });
  const extraAmbush = canDeclareUnlocatedAmbush(difficulty, highestHostileLoc(snapshot));
  const pathPolicy = locatedPathAmbushPolicy(difficulty);
  const locatedPathConditional =
    hasLocatedPath(snapshot) && pathPolicy.timing === "conditional" && !extraAmbush;
  let maxStandardActions = maxStandardActionsThisRound({
    difficulty,
    hitEvPositive,
    extraAmbushStandard: extraAmbush,
    initiativeBound: maxStandardActionsInRound(snapshot.initiativeRemaining),
  });
  const flank = hereFire <= 0 && snapshot.ammo.roundsInMagazine > 0 && snapshot.ammo.expectedDamageDice > 0 &&
    (difficulty === "professional" || (difficulty === "expert" && rng() < 0.25));
  let approach: { x: number; y: number } | undefined;
  if (flank) {
    let nearest: WalkRoute | null = null;
    for (const target of plannedLocs) {
      if (target.localization !== "exact" && target.localization !== "full") continue;
      const route = walkPath(snapshot.position, target.position, combatMapWalkWalls(map));
      if (route && (!nearest || route.meters < nearest.meters)) nearest = route;
    }
    if (nearest) {
      // Stop at the last firing corner, or the close-range boundary on an open approach.
      const corner = nearest.points[nearest.points.length - 2]!;
      const target = nearest.points[nearest.points.length - 1]!;
      const approachMeters = nearest.points.length > 2
        ? nearest.meters - Math.hypot(target.x - corner.x, target.y - corner.y)
        : Math.max(0, nearest.meters - Math.max(2.5, snapshot.weapon.rangeM * 0.5));
      const meters = Math.min(remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound),
        approachMeters);
      if (meters > 1e-6) approach = pointAlongPolyline(nearest.points, meters);
    }
  }
  const stances = buildStances(snapshot, map, approach ? [...extraStances, approach] : extraStances);
  const stancePositions = [
    snapshot.position,
    ...stances.map(s => s.position),
  ];
  // Trained and below judge combat by headcount, not hidden weapon/damage estimates (Q10).
  const weighsDamage = difficulty === "expert" || difficulty === "professional";
  const hereRisk = weighsDamage ? incomingDamage(snapshot, map, snapshot.position) : 0;
  const risks = stancePositions.map(from => weighsDamage ? incomingDamage(snapshot, map, from) : 0);
  const enemiesForCover = plannedLocs.filter(p => p.localization !== "none");
  const coverIds = stancePositions.map(from => map.barriers.find(barrier => enemiesForCover.some(enemy => mapCoverBandOnLineOfEffect({ shooter: enemy.position, target: from, targetEnteredCoverId: null, barriers: [barrier] })))?.id ?? null);
  const protectedTile = (tile: number) => coverIds[tile] !== null;
  const conceal = concealWhenExpectedKilled(difficulty, snapshot.expectedToBeKilled === true || (hereRisk > 0 && hereRisk >= (snapshot.hitPoints ?? Infinity)), rng);
  const outnumbered = hostileCount > (snapshot.allyCount ?? 1);
  const losing = hereRisk > hereFire;
  const seekCover = conceal !== "none" || (difficulty === "trained" && (outnumbered || !hitEvPositive)) ||
    ((difficulty === "expert" || difficulty === "professional") && losing);
  const firingTiles = stancePositions.map((from, tile) => ({ tile,
    damage: Math.max(0, ...snapshot.targets.map(t => standardFireExpectation({ ...snapshot, coverId: null }, map.barriers, from, t).damage)) }))
    .filter(({ tile, damage }) => damage > 0 && (tile === 0 || stances[tile - 1]!.cost + snapshot.metersMovedThisRound <= snapshot.mov + 1e-6));
  const moveCostAt = (tile: number) => tile === 0 ? 0 : stances[tile - 1]!.cost;
  let requiredTile: number | undefined;
  let movementReason: string | undefined;
  const disengaging = weighsDamage && outnumbered &&
    (losing || (snapshot.disengaging === true && (hereFire <= hereRisk || hereRisk >= (snapshot.hitPoints ?? Infinity))));
  const fireDamageAtTile = (tile: number) => firingTiles.find(f => f.tile === tile)?.damage ?? 0;
  const maxRepositionFire = Math.max(0, ...firingTiles.filter(f => f.tile > 0).map(f => f.damage));
  const stalemateNeedsReposition =
    wantsCover &&
    hostileCount > 0 &&
    hereFire <= 0 &&
    (maxRepositionFire > hereFire + 1e-6 ||
      firingTiles.some(({ tile, damage }) => tile > 0 && protectedTile(tile) && damage > 0));
  const allowRepositionIncentive =
    stalemateNeedsReposition &&
    !disengaging &&
    snapshot.disengaging !== true &&
    (!outnumbered || losing || conceal !== "none");
  const passTurnPenalty = allowRepositionIncentive ? PASS_TURN_UTILITY_PENALTY : 0;
  const movementUtility = (tile: number, moveCost: number | undefined): number => {
    if (!wantsCover) return 0;
    if (tile === 0) return passTurnPenalty > 0 ? -passTurnPenalty : 0;
    const fire = fireDamageAtTile(tile);
    let u = hereRisk - risks[tile]! - (moveCost ?? 0) * 1e-4;
    if (allowRepositionIncentive) {
      if (fire > hereFire + 1e-6) u += REPOSITION_FIRE_BONUS_SCALE * (fire - hereFire);
      if (protectedTile(tile) && fire > 0 && !protectedTile(0)) u += COVERED_FIRE_UTILITY_BONUS;
    }
    return u;
  };
  if (seekCover) {
    let candidates = stancePositions.map((_, tile) => tile).filter(tile => protectedTile(tile) && (tile === 0 || risks[tile]! <= hereRisk + 1e-6));
    if (hereFire <= 0 && conceal === "none") {
      const moveLimit = difficulty === "trained" ? snapshot.mov * 0.5 : snapshot.mov;
      const returnFire = firingTiles.map(({ tile }) => tile).filter(tile => tile > 0 && protectedTile(tile) &&
        moveCostAt(tile) + snapshot.metersMovedThisRound <= moveLimit + 1e-6);
      // A nearby cover position must allow retaliation; distance zero must not lock us behind a wall forever.
      if (returnFire.length > 0) candidates = returnFire;
    }
    candidates.sort((a, b) => (a === 0 ? 0 : stances[a - 1]!.cost) - (b === 0 ? 0 : stances[b - 1]!.cost));
    requiredTile = candidates[0];
  }
  if (wantsCover && conceal === "none" && requiredTile === undefined) {
    // Advance through useful cover even when winning; a sealed wall with no return fire is not a firing position.
    const coveredFire = firingTiles.filter(({ tile }) => protectedTile(tile) && risks[tile]! <= hereRisk + 1e-6);
    coveredFire.sort((a, b) => risks[a.tile]! - risks[b.tile]! || b.damage - a.damage || moveCostAt(a.tile) - moveCostAt(b.tile));
    requiredTile = coveredFire[0]?.tile;
    if (requiredTile !== undefined && requiredTile > 0) movementReason = "推进：选择可还击的掩体";
  }
  if (flank && conceal === "none" && (requiredTile === undefined || requiredTile === 0)) {
    const flankFire = firingTiles.filter(({ tile }) => tile > 0);
    flankFire.sort((a, b) => risks[a.tile]! - risks[b.tile]! || b.damage - a.damage || moveCostAt(a.tile) - moveCostAt(b.tile));
    const approachTile = approach ? stancePositions.findIndex(p => Math.hypot(p.x - approach.x, p.y - approach.y) < 1e-6) : -1;
    requiredTile = flankFire[0]?.tile ?? (approachTile > 0 ? approachTile : requiredTile);
  }
  // A losing exchange while outnumbered is unwinnable without first breaking contact.
  // Do not turn a headcount disadvantage alone into retreat from harmless opponents.
  const minHostileDistM = plannedLocs
    .filter(p => p.localization !== "none")
    .reduce((min, p) => Math.min(min, Math.hypot(p.position.x - snapshot.position.x, p.position.y - snapshot.position.y)), Infinity);
  const favorableReentry =
    snapshot.disengaging === true &&
    outnumbered &&
    hereFire > hereRisk + 1e-6 &&
    hitEvPositive &&
    minHostileDistM >= 5 &&
    snapshot.attackBonus >= 20;
  const holdingDisengage =
    snapshot.disengaging === true && outnumbered && !favorableReentry;
  if (disengaging) {
    requiredTile = 0;
    movementReason = difficulty === "professional" ? "脱战后守候：等待有利交火机会" : "脱战后守候：避免重新进入不利交火";
    const known = plannedLocs.filter(t => t.localization === "exact" || t.localization === "full");
    if (known.length > 0 && hereRisk > 0) {
      const exposed = stancePositions.map(from => known.filter(t => hasLineOfSight(from, t.position, map.walls)).length);
      const distance = stancePositions.map(from => Math.min(...known.map(t => Math.hypot(from.x - t.position.x, from.y - t.position.y))));
      const escapes = stances.map((_, i) => i + 1).filter(tile => risks[tile]! <= hereRisk + 1e-6 &&
        (risks[tile]! < hereRisk - 1e-6 || exposed[tile]! < exposed[0]! || distance[tile]! > distance[0]! + 1e-6));
      escapes.sort((a, b) => risks[a]! - risks[b]! || exposed[a]! - exposed[b]! || distance[b]! - distance[a]! || stances[a - 1]!.cost - stances[b - 1]!.cost);
      if (escapes.length > 0) {
        requiredTile = escapes[0];
        maxStandardActions = 0;
        movementReason = "脱战：人数劣势且交火预期不利";
      }
    }
  }
  if (snapshot.declaredStandardActions !== undefined) {
    maxStandardActions = Math.min(maxStandardActions, Math.max(0, snapshot.declaredStandardActions - (snapshot.standardActionsThisRound ?? 0)));
  } else if (snapshot.targets.length > 0 && maxStandardActions > 1) {
    let bestTotal = -Infinity, bestCount = 1;
    for (let count = 1; count <= maxStandardActions; count++) {
      for (const [tile, from] of stancePositions.entries()) {
        if (requiredTile !== undefined && requiredTile !== tile) continue;
        if (snapshot.metersMovedThisRound + (tile === 0 ? 0 : stances[tile - 1]!.cost) > snapshot.mov + 1e-6) continue;
        let state = { ...snapshot, declaredStandardActions: count, declaredStandardFires: count };
        let total = 0;
        for (let round = 0; round < count; round++) {
          let best = 0, distance = 0;
          for (const target of snapshot.targets) {
            const value = standardFireExpectation(state, map.barriers, from, target).damage;
            if (value > best) { best = value; const pos = planningTarget(snapshot, target).position; distance = Math.hypot(pos.x - from.x, pos.y - from.y); }
          }
          total += best;
          const bestView = snapshot.targets.reduce<CombatTargetView | undefined>((chosen, target) => {
            const value = standardFireExpectation(state, map.barriers, from, target).damage;
            const bestValue = chosen ? standardFireExpectation(state, map.barriers, from, chosen).damage : -Infinity;
            return value > bestValue ? target : chosen;
          }, undefined);
          const plan = planStandardFire(
            state,
            distance,
            () => 0,
            bestView
              ? standardFirePlanOptsForView(state, map.barriers, from, bestView, distance, count)
              : undefined,
          );
          state = { ...applyStandardFireToSnapshot(state, plan), declaredStandardActions: count };
        }
        if (total > bestTotal + 1e-6) { bestTotal = total; bestCount = count; }
      }
    }
    maxStandardActions = bestCount;
  }
  const escapingThisRound =
    disengaging &&
    requiredTile !== undefined &&
    requiredTile > 0 &&
    movementReason?.startsWith("脱战：") === true &&
    !holdingDisengage;
  if (holdingDisengage && !escapingThisRound) {
    requiredTile = 0;
    movementReason ??=
      difficulty === "professional" ? "脱战后守候：等待有利交火机会" : "脱战后守候：避免重新进入不利交火";
  }
  const initiativeRounds = Math.max(1, maxStandardActions);
  const targetIds: (string | null)[] = [null];
  for (const t of snapshot.targets) targetIds.push(t.id);

  const shape: ActionFeasibilityShape = {
    initiativeRounds,
    kinds: ACTION_KINDS.length,
    reachableTiles: stancePositions.length,
    targets: targetIds.length,
  };

  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);

  const moveKind = actionKindIndex("move");
  const fireKind = actionKindIndex("standard_fire");
  const suppressKind = actionKindIndex("suppressive_fire");
  const reloadKind = actionKindIndex("standard_reload");
  const throwKind = actionKindIndex("throw");
  const aimKind = actionKindIndex("standard_aim");

  const budget = remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound);
  const allFuzzy =
    plannedLocs.length > 0 && plannedLocs.every(p => p.localization === "approximate");
  const aim = preferredAimPlan({
    difficulty,
    hitEvPositive,
    keyKill: snapshot.keyKill === true,
    rng,
  });

  for (let round = 0; round < initiativeRounds; round++) {
    for (let tile = 0; tile < stancePositions.length; tile++) {
      const from = stancePositions[tile]!;
      const moveCost = tile === 0 ? 0 : stances[tile - 1]?.cost;
      if (requiredTile !== undefined && tile !== requiredTile) continue;
      let shotSnapshot: CombatSnapshot = {
        ...snapshot,
        coverId: null,
        declaredStandardActions: snapshot.declaredStandardActions ?? maxStandardActions,
        declaredStandardFires: snapshot.declaredStandardFires ?? maxStandardActions,
        standardFiresThisRound: snapshot.standardFiresThisRound ?? 0,
      };
      for (let prior = 0; prior < round; prior++) {
        const best = snapshot.targets.reduce<CombatTargetView | undefined>((chosen, target) => !chosen || standardFireExpectation(shotSnapshot, map.barriers, from, target).damage > standardFireExpectation(shotSnapshot, map.barriers, from, chosen).damage ? target : chosen, undefined);
        const target = best ? planningTarget(snapshot, best).position : from;
        const priorDistance = Math.hypot(target.x - from.x, target.y - from.y);
        const priorView = best
          ? snapshot.targets.find((row) => row.id === best.id)
          : undefined;
        shotSnapshot = {
          ...applyStandardFireToSnapshot(
            shotSnapshot,
            planStandardFire(
              shotSnapshot,
              priorDistance,
              () => 0,
              priorView
                ? standardFirePlanOptsForView(
                    shotSnapshot,
                    map.barriers,
                    from,
                    priorView,
                    priorDistance,
                  )
                : undefined,
            ),
          ),
          declaredStandardActions: shotSnapshot.declaredStandardActions,
        };
      }

      if (round === 0 && (tile === 0 || (moveCost != null && moveCost <= budget + 1e-6))) {
        const mi = actionFeasibilityIndex(shape, round, moveKind, tile, 0);
        feasibility.legal[mi] = 1;
        utility[mi] = movementUtility(tile, moveCost);
      }

      if (conceal === "conceal" && requiredTile === tile && coverIds[tile]) {
        if (round === 0) {
          const ci = actionFeasibilityIndex(shape, round, actionKindIndex("enter_cover"), tile, 0);
          feasibility.legal[ci] = 1;
          utility[ci] = Math.max(0, risks[tile]! - incomingDamage({ ...snapshot, position: from, coverId: coverIds[tile]! }, map, from));
        }
        continue;
      }
      if (round === 0 && snapshot.coverId) {
        const li = actionFeasibilityIndex(shape, round, actionKindIndex("leave_cover"), tile, 0);
        feasibility.legal[li] = 1;
      }
      if (snapshot.metersMovedThisRound + (moveCost ?? 0) > snapshot.mov + 1e-6) continue;
      for (let target = 1; target < targetIds.length; target++) {
        const view = snapshot.targets[target - 1];
        if (!view) continue;
        const planned = plannedLocs[target - 1]!;

        const canFire =
          snapshot.ammo.roundsInMagazine > 0 &&
          canDifficultyFireAtLoc(difficulty, asPolicyLoc(planned.localization), opts);

        if (canFire) {
          const fi = actionFeasibilityIndex(shape, round, fireKind, tile, target);
          feasibility.legal[fi] = 1;
          utility[fi] = fireUtility(shotSnapshot, map, from, target);
        }

        if (throwLegalForTarget(snapshot, planned.localization, rng, locatedPathConditional)) {
          const ti = actionFeasibilityIndex(shape, round, throwKind, tile, target);
          feasibility.legal[ti] = 1;
          utility[ti] = throwActionUtility(snapshot, from, planned.position);
        }
      }

      if (round === 0 && tile === 0) {
        const suppressOk =
          suppressiveFireLegal(snapshot) &&
          allowsThrowOrSuppress(difficulty) &&
          !(locatedPathConditional && !pathPolicy.allowThrowSuppress) &&
          (!allFuzzy || isThrowOrSuppressLegalForFuzzy(difficulty, rng)) &&
          !(allFuzzy && difficulty === "professional" && throwActionLegal(snapshot));
        if (suppressOk) {
          const si = actionFeasibilityIndex(shape, round, suppressKind, tile, 0);
          feasibility.legal[si] = 1;
          const planSnap = { ...snapshot, declaredStandardActions: snapshot.declaredStandardActions ?? 1 };
          const rawSuppress = suppressiveFireUtility(planSnap, map, from);
          const bestDirect = bestStandardFireUtility(planSnap, map, from);
          const tileLosing = weighsDamage
            ? incomingDamage({ ...snapshot, position: from, coverId: tile === 0 ? snapshot.coverId : null }, map, from) >
              Math.max(0, ...snapshot.targets.map((t) => standardFireExpectation({ ...snapshot, coverId: null }, map.barriers, from, t).damage))
            : losing;
          utility[si] = suppressiveFirePlanningUtility({
            difficulty,
            rawUtility: rawSuppress,
            bestDirectFireUtility: bestDirect,
            allFuzzy,
            losing: tileLosing,
            rng,
          });
        }
        if (snapshot.ammo.roundsInMagazine < 10) {
          const ri = actionFeasibilityIndex(shape, round, reloadKind, tile, 0);
          feasibility.legal[ri] = 1;
          utility[ri] = snapshot.ammo.roundsInMagazine === 0 ? 1 : 0;
        }
        if (aim.rounds > 0) {
          const ai = actionFeasibilityIndex(shape, round, aimKind, tile, 0);
          feasibility.legal[ai] = 1;
          utility[ai] = 0;
        }
      }
    }
  }

  return {
    shape,
    feasibility,
    utility,
    stancePositions,
    walls: combatMapWalkWalls(map),
    targetIds,
    barrierVersion: snapshot.barrierVersion,
    sustainedFireToken: snapshot.sustainedFire.token,
    maxStandardActions,
    locatedPathConditional,
    coverIds,
    disengaging: holdingDisengage || (disengaging && !favorableReentry),
    holdingDisengage,
    favorableReentry,
    ...(movementReason ? { movementReason } : {}),
  };
}
