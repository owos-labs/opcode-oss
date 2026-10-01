import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
} from "../combat-ai/action-feasibility.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import type { ActionFeasibilityShape } from "../combat-ai/action-feasibility.ts";

/** Turn slot vs tensor round: replanned payloads index from 0 with fewer initiative rounds. */
export function feasibilityRoundForSlot(
  slot: number,
  shape: ActionFeasibilityShape,
  actions: readonly { round: number }[],
): number | null {
  const { initiativeRounds } = shape;
  if (initiativeRounds <= 0) return null;
  if (slot >= 0 && slot < initiativeRounds) return slot;
  if (actions.some((a) => a.round === slot)) {
    return Math.min(slot, initiativeRounds - 1);
  }
  let minRound: number | null = null;
  for (const a of actions) {
    if (a.round < 0 || a.round >= initiativeRounds) continue;
    if (minRound === null || a.round < minRound) minRound = a.round;
  }
  return minRound;
}

export function formatPlanMoveDebug(
  from: Vec2 | undefined,
  to: Vec2 | null | undefined,
  stayReason?: string,
  walkMeters?: number,
): string {
  if (from && to) {
    const meters = walkMeters ?? Math.hypot(to.x - from.x, to.y - from.y);
    if (meters >= 1e-3) {
      return `移动 ${meters.toFixed(1)}m → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`;
    }
  }
  return `不移动：${stayReason ?? "移位没有更高分"}`;
}

export function planStayReason(input: {
  payload: PlanningPayload;
  actions: readonly ActionIntent[];
  slot: number;
  movRemaining?: number;
  coverId?: string | null;
  profileId?: NpcDifficultyId;
}): string {
  if (input.payload.disengaging && input.payload.movementReason) return input.payload.movementReason;
  if (input.movRemaining !== undefined && input.movRemaining <= 1e-6) return "移动力已用完";
  if (input.payload.stancePositions.length <= 1) return "没有其它可走站位";

  const kinds = input.actions
    .filter((a) => a.round === input.slot)
    .map((a) => ACTION_KINDS[a.kind] ?? "");
  if (input.profileId === "newstupid" && kinds.some((k) => k !== "move" && k !== "enter_cover")) {
    return "简单：本段用标准动作，不能同时移动";
  }
  if (kinds.includes("suppressive_fire")) return "本段火力压制，必须留在原地";
  if (kinds.includes("standard_reload")) return "弹少，原地装填";
  if (kinds.includes("standard_aim")) return "原地瞄准";
  if (kinds.includes("throw")) return "原地投掷更合适";

  const shape = input.payload.shape;
  const feasibilityRound = shape
    ? feasibilityRoundForSlot(input.slot, shape, input.actions)
    : null;
  if (shape && feasibilityRound !== null && input.payload.feasibility && input.payload.utility) {
    const fire = actionKindIndex("standard_fire");
    let here = -Infinity;
    let elsewhere = -Infinity;
    for (let tile = 0; tile < shape.reachableTiles; tile++) {
      for (let target = 1; target < shape.targets; target++) {
        const idx = actionFeasibilityIndex(shape, feasibilityRound, fire, tile, target);
        if (input.payload.feasibility.legal[idx] !== 1) continue;
        const u = input.payload.utility[idx] ?? -Infinity;
        if (tile === 0) here = Math.max(here, u);
        else elsewhere = Math.max(elsewhere, u);
      }
    }
    if (here === 0 && elsewhere <= 0 && !kinds.includes("standard_fire")) {
      return "当前可选站位均无有效射击收益";
    }
    if (Number.isFinite(here) && here > 0 && here + 1e-9 >= elsewhere) {
      if (input.coverId) return "已在掩体，原地开火分更高";
      if (kinds.includes("standard_fire")) {
        return Number.isFinite(elsewhere)
          ? "可走站位的开火/掩体分不超过这里"
          : "没有其它可开火站位";
      }
      return "当前位置出手分最高";
    }
  }

  if (kinds.includes("standard_fire")) return "本段用于射击，不必换位";
  return "移位没有更高分";
}

export function actionKindLabel(kindIndex: number): string {
  return ACTION_KINDS[kindIndex] ?? `kind_${kindIndex}`;
}

export function describePlanStep(
  payload: PlanningPayload,
  action: ActionIntent,
  targetLabel?: (targetId: string | null) => string,
  stayReason?: string,
): string {
  const kind = actionKindLabel(action.kind);
  const tile = payload.stancePositions[action.tile];
  const origin = payload.stancePositions[0];
  const targetId = payload.targetIds[action.target] ?? null;
  const tgtName = targetLabel ? targetLabel(targetId) : targetId ? targetId.slice(0, 8) : "";
  const tgt = tgtName ? ` @ ${tgtName}` : "";
  if (kind === "move") {
    const reason = action.tile > 0 && payload.movementReason ? ` · ${payload.movementReason}` : "";
    return `R${action.round + 1} ${formatPlanMoveDebug(origin ?? tile, tile, stayReason)}${reason} · ${action.timing}`;
  }
  const showTile = kind !== "suppressive_fire";
  const pos = showTile && tile ? `→ (${tile.x.toFixed(1)}, ${tile.y.toFixed(1)}) m` : "";
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
