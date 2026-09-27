import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
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
      const dist = Math.hypot(tile.x - snapshot.position.x, tile.y - snapshot.position.y);
      const budget = remainingMoveBudgetMeters(next.mov, next.metersMovedThisRound);
      if (dist <= budget + 1e-6) {
        next = {
          ...next,
          position: { x: tile.x, y: tile.y },
          metersMovedThisRound: next.metersMovedThisRound + dist,
        };
      }
    }
  } else if (kind === "standard_fire" || kind === "suppressive_fire") {
    const rounds =
      kind === "suppressive_fire" ? Math.max(1, Math.floor(next.weapon.rateOfFire / 20)) : 1;
    next = {
      ...next,
      ammo: {
        ...next.ammo,
        roundsInMagazine: Math.max(0, next.ammo.roundsInMagazine - rounds),
      },
    };
  } else if (kind === "standard_reload") {
    next = {
      ...next,
      ammo: { ...next.ammo, roundsInMagazine: 30 },
    };
  }

  return next;
}
