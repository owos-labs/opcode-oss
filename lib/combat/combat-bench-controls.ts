import type { CombatBenchSession } from "./combat-bench.ts";
import { shouldAdvanceCombatBenchRound } from "./combat-bench.ts";

/** Engagement started and not yet resolved. */
export function benchFightActive(session: CombatBenchSession | null): boolean {
  return session !== null && !session.combatEnded;
}

/** Deployed units can be removed or reconfigured (not during an active fight). */
export function benchCanEditRoster(session: CombatBenchSession | null): boolean {
  return !benchFightActive(session);
}

export function benchStartAllowed(input: {
  session: CombatBenchSession | null;
  validationOk: boolean;
  mapReady: boolean;
  busy: boolean;
}): boolean {
  if (input.busy || !input.validationOk || !input.mapReady) return false;
  return !benchFightActive(input.session);
}

/** Step is allowed for the whole fight; round boundaries are handled inside step. */
export function benchStepAllowed(input: {
  session: CombatBenchSession | null;
  benchMapReady: boolean;
  busy: boolean;
}): boolean {
  if (input.busy || !input.session || !input.benchMapReady) return false;
  return !input.session.combatEnded;
}

/** True when the next step will roll into the next 3s combat round (or is waiting on one). */
export function benchStepAtRoundBoundary(session: CombatBenchSession | null): boolean {
  if (!session || session.combatEnded) return false;
  return shouldAdvanceCombatBenchRound(session);
}
