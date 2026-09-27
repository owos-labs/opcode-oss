import { isActionLegal } from "../combat-ai/action-feasibility.ts";
import type { ScoredActionOption } from "../combat-ai/planning.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import type { CombatSnapshot } from "./snapshot.ts";

const EPS = 1e-6;

/** Whether this scored option is legal at the current simulated snapshot (not just the static tensor). */
export function planActionLegalAtSnapshot(
  snapshot: CombatSnapshot,
  payload: PlanningPayload,
  option: ScoredActionOption,
): boolean {
  const { feasibility } = payload;
  if (
    !isActionLegal(feasibility, option.round, option.kind, option.tile, option.target)
  ) {
    return false;
  }

  if (option.kindId === "move") {
    if (option.tile === 0) return true;
    const dest = payload.stancePositions[option.tile];
    if (!dest) return false;
    const dist = Math.hypot(dest.x - snapshot.position.x, dest.y - snapshot.position.y);
    return dist <= remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound) + EPS;
  }

  if (option.kindId === "standard_fire" || option.kindId === "suppressive_fire") {
    return snapshot.ammo.roundsInMagazine > 0;
  }

  return true;
}
