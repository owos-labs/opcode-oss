import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import { walkPathMeters } from "../combat-ai/walk-path.ts";
import { clampSuppressiveRoundsSpent } from "./actions/suppressive-action.ts";
import {
  applyStandardFireToSnapshot,
  planStandardFire,
  remainingWeaponRoundsThisRound,
  standardFireTargetDistance,
} from "./fire-mode.ts";
import { standardFirePlanOptsForView } from "./attack-expectation.ts";
import type { CombatSnapshot } from "./snapshot.ts";

export function applyPlanStepToSnapshot(
  snapshot: CombatSnapshot,
  payload: PlanningPayload,
  action: ActionIntent,
): CombatSnapshot {
  const kind = ACTION_KINDS[action.kind];
  let next = snapshot;

  if (kind === "move") {
    const tile = payload.stancePositions[action.tile];
    if (tile) {
      const budget = remainingMoveBudgetMeters(next.mov, next.metersMovedThisRound);
      const dist = walkPathMeters(snapshot.position, tile, payload.walls ?? [], {
        cellSize: 1,
        maxMeters: budget,
      });
      if (dist != null) {
        next = {
          ...next,
          position: { x: tile.x, y: tile.y },
          coverId: dist > 1e-6 ? null : next.coverId,
          metersMovedThisRound: next.metersMovedThisRound + dist,
        };
      }
    }
  } else if (kind === "enter_cover") {
    next = { ...next, coverId: payload.coverIds?.[action.tile] ?? next.coverId };
  } else if (kind === "leave_cover") {
    next = { ...next, coverId: null };
  } else if (kind === "standard_fire") {
    const distance = standardFireTargetDistance(next, payload, action);
    const targetId = payload.targetIds[action.target] ?? null;
    const view = targetId ? next.targets.find((t) => t.id === targetId) : undefined;
    next = applyStandardFireToSnapshot(
      next,
      planStandardFire(
        next,
        distance,
        () => 0,
        view
          ? standardFirePlanOptsForView(next, [], next.position, view, distance)
          : undefined,
      ),
    );
  } else if (kind === "suppressive_fire") {
    const rounds = clampSuppressiveRoundsSpent(
      next.weapon?.rateOfFire ?? 0,
      Math.min(next.ammo?.roundsInMagazine ?? 0, remainingWeaponRoundsThisRound(next)),
    );
    next = {
      ...next,
      ammo: {
        ...next.ammo,
        roundsInMagazine: Math.max(0, (next.ammo?.roundsInMagazine ?? 0) - rounds),
      },
      weaponRoundsThisRound: (next.weaponRoundsThisRound ?? 0) + rounds,
      standardActionsThisRound: (next.standardActionsThisRound ?? 0) + 1,
      sustainedFire: {
        active: false,
        walkFireMalus: 0,
        token: (next.sustainedFire?.token ?? 0) + 1,
      },
    };
  } else if (kind === "standard_reload") {
    next = {
      ...next,
      ammo: { ...next.ammo, roundsInMagazine: 30 },
      standardActionsThisRound: (next.standardActionsThisRound ?? 0) + 1,
      sustainedFire: { active: false, walkFireMalus: 0, token: (next.sustainedFire?.token ?? 0) + 1 },
    };
  }

  return next;
}
