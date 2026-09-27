import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

export function actionKindLabel(kindIndex: number): string {
  return ACTION_KINDS[kindIndex] ?? `kind_${kindIndex}`;
}

export function describePlanStep(
  payload: PlanningPayload,
  action: ActionIntent,
  targetLabel?: (targetId: string | null) => string,
): string {
  const kind = actionKindLabel(action.kind);
  const tile = payload.stancePositions[action.tile];
  const targetId = payload.targetIds[action.target] ?? null;
  const pos = tile ? `→ (${tile.x.toFixed(1)}, ${tile.y.toFixed(1)}) m` : "";
  const tgtName = targetLabel ? targetLabel(targetId) : targetId ? targetId.slice(0, 8) : "";
  const tgt = tgtName ? ` @ ${tgtName}` : "";
  return `R${action.round + 1} ${kind}${pos}${tgt} · ${action.timing}`;
}

export type PlanIntentRow = {
  index: number;
  round: number;
  timing: ActionIntent["timing"];
  text: string;
};

export function planIntentRows(
  payload: PlanningPayload,
  plan: RoundPlan,
  targetLabel?: (targetId: string | null) => string,
): PlanIntentRow[] {
  return plan.actions.map((action, index) => ({
    index,
    round: action.round,
    timing: action.timing,
    text: describePlanStep(payload, action, targetLabel),
  }));
}

export type InitiativeRoundPlanGroup = {
  round: number;
  rows: PlanIntentRow[];
};

export function planGroupedByInitiativeRound(
  payload: PlanningPayload,
  plan: RoundPlan,
  targetLabel?: (targetId: string | null) => string,
): InitiativeRoundPlanGroup[] {
  const rows = planIntentRows(payload, plan, targetLabel);
  const byRound = new Map<number, PlanIntentRow[]>();
  for (const row of rows) {
    const list = byRound.get(row.round) ?? [];
    list.push(row);
    byRound.set(row.round, list);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, groupRows]) => ({ round, rows: groupRows }));
}
