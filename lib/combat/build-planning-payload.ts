import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  type ActionFeasibilityShape,
  type ActionFeasibilityTensor,
} from "../combat-ai/action-feasibility.ts";
import { expectedArmorPenetration, armorPenetrationDamageFactor } from "../combat-ai/armor-penetration.ts";
import { getNpcDifficultyProfile } from "../combat-ai/difficulty.ts";
import {
  localTacticalStances,
  orderedBarrierHits,
  type TacticalStance,
} from "../combat-ai/geometry.ts";
import { suppressiveFireLegal, suppressiveFireUtility } from "./actions/suppressive-action.ts";
import { throwActionLegal, throwActionUtility } from "./actions/throw-action.ts";
import { resolveBallisticToTarget } from "./ballistic.ts";
import { maxStandardActionsInRound } from "./initiative.ts";
import {
  canConditionalFireWhenTargetVisible,
  canImmediateDirectFire,
  localizationHitDifficultyAdd,
} from "./localization.ts";
import type { MapSolveBounds } from "./map-adapter/compile-svg-map.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import { rangeBandDifficulty, rangeUtilityPenalty } from "./range-difficulty.ts";
import type { CombatSnapshot } from "./snapshot.ts";

export type PlanningPayload = {
  shape: ActionFeasibilityShape;
  feasibility: ActionFeasibilityTensor;
  utility: Float32Array;
  /** Stance index → world position (0 = snapshot.position). */
  stancePositions: readonly { x: number; y: number }[];
  /** Target index → target id (0 = none). */
  targetIds: readonly (string | null)[];
  barrierVersion: number;
  sustainedFireToken: number;
};

function initiativeRoundsForSnapshot(snapshot: CombatSnapshot): number {
  const profile = getNpcDifficultyProfile(snapshot.encounter.profileId);
  if (profile.maxInitiativeRounds === 0) return 1;
  if (profile.maxInitiativeRounds === 2) {
    return Math.min(2, Math.max(1, maxStandardActionsInRound(snapshot.initiativeRemaining)));
  }
  return Math.max(1, maxStandardActionsInRound(snapshot.initiativeRemaining));
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

function buildStances(snapshot: CombatSnapshot, map: CompiledCombatMap): TacticalStance[] {
  const budget = remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound);
  const extras = localTacticalStances({
    origin: snapshot.position,
    movBudget: budget,
    cellSize: 1,
    walls: map.walls,
    maxStances: 15,
  });
  if (!map.solveBounds) return extras;
  return extras.filter(s => pointInSolveBounds(s.position, map.solveBounds));
}

function fireUtility(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
  from: { x: number; y: number },
  targetIndex: number,
  stanceTargets: { id: string; position: { x: number; y: number } }[],
): number {
  const target = stanceTargets[targetIndex - 1];
  if (!target) return -Infinity;

  const view = snapshot.targets.find(t => t.id === target.id);
  if (!view) return -Infinity;

  const profile = getNpcDifficultyProfile(snapshot.encounter.profileId);
  if (!canImmediateDirectFire(view.localization) && !canConditionalFireWhenTargetVisible(view.localization)) {
    return -Infinity;
  }

  const dist = Math.hypot(target.position.x - from.x, target.position.y - from.y);
  const rangeDiff = rangeBandDifficulty(dist, snapshot.weapon.rangeM);
  const locDiff = localizationHitDifficultyAdd(view.localization);

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

  let u =
    ballistic.expectedDamageDice * penFactor * 3 -
    rangeUtilityPenalty(rangeDiff) * 10 -
    locDiff * 0.15;

  if (canConditionalFireWhenTargetVisible(view.localization)) {
    u += 0.12;
  }
  if (snapshot.sustainedFire.active) {
    u += 0.5 - snapshot.sustainedFire.walkFireMalus * 0.05;
  }
  u += snapshot.weapon.accuracy * 0.1;

  return u;
}

export function buildPlanningPayload(
  snapshot: CombatSnapshot,
  map: CompiledCombatMap,
): PlanningPayload {
  const stances = buildStances(snapshot, map);
  const stancePositions = [
    snapshot.position,
    ...stances.map(s => s.position),
  ];
  const targetIds: (string | null)[] = [null];
  for (const t of snapshot.targets) targetIds.push(t.id);

  const initiativeRounds = initiativeRoundsForSnapshot(snapshot);
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

  const budget = remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound);
  const enemies = snapshot.targets.map(t => ({
    id: t.id,
    position: t.position,
  }));

  for (let round = 0; round < initiativeRounds; round++) {
    for (let tile = 0; tile < stancePositions.length; tile++) {
      const from = stancePositions[tile]!;
      const moveCost = tile === 0 ? 0 : Math.hypot(from.x - snapshot.position.x, from.y - snapshot.position.y);

      if (tile === 0 || moveCost <= budget + 1e-6) {
        const mi = actionFeasibilityIndex(shape, round, moveKind, tile, 0);
        feasibility.legal[mi] = 1;
        utility[mi] = tile === 0 ? 0.1 : 2 - moveCost * 0.05;
      }

      for (let target = 1; target < targetIds.length; target++) {
        const view = snapshot.targets[target - 1];
        if (!view) continue;

        const canFire =
          snapshot.ammo.roundsInMagazine > 0 &&
          (canImmediateDirectFire(view.localization) ||
            canConditionalFireWhenTargetVisible(view.localization));

        if (canFire) {
          const fi = actionFeasibilityIndex(shape, round, fireKind, tile, target);
          feasibility.legal[fi] = 1;
          utility[fi] = fireUtility(snapshot, map, from, target, enemies);
        }

        if (throwActionLegal(snapshot)) {
          const ti = actionFeasibilityIndex(shape, round, throwKind, tile, target);
          feasibility.legal[ti] = 1;
          utility[ti] = throwActionUtility(snapshot, from, view.position);
        }
      }

      if (round === 0 && tile === 0) {
        if (suppressiveFireLegal(snapshot)) {
          const si = actionFeasibilityIndex(shape, round, suppressKind, tile, 0);
          feasibility.legal[si] = 1;
          utility[si] = suppressiveFireUtility(snapshot);
        }
        if (snapshot.ammo.roundsInMagazine < 10) {
          const ri = actionFeasibilityIndex(shape, round, reloadKind, tile, 0);
          feasibility.legal[ri] = 1;
          utility[ri] = 5;
        }
      }
    }
  }

  return {
    shape,
    feasibility,
    utility,
    stancePositions,
    targetIds,
    barrierVersion: snapshot.barrierVersion,
    sustainedFireToken: snapshot.sustainedFire.token,
  };
}
