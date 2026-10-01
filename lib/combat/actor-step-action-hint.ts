import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import { fireModeActionLabel, planStandardFire } from "./fire-mode.ts";
import type { CombatSnapshot } from "./snapshot.ts";

type HintAction = {
  round: number;
  kind: number;
  tile: number;
  target: number;
};

function loc(point: { x: number; y: number }): string {
  return `(${Math.round(point.x)}, ${Math.round(point.y)})`;
}

function movedTo(
  from: { x: number; y: number },
  action: HintAction,
  stancePositions: readonly { x: number; y: number }[],
): { x: number; y: number } {
  const id = ACTION_KINDS[action.kind];
  if (id !== "move" && id !== "enter_cover") return from;
  return stancePositions[action.tile] ?? from;
}

function standardDetail(
  kind: string,
  action: HintAction,
  from: { x: number; y: number },
  targetIds: readonly (string | null)[],
  targetLabel: (id: string) => string,
  snapshot?: CombatSnapshot,
): string {
  const targetId = targetIds[action.target] ?? null;
  const name = targetId ? targetLabel(targetId) : "";
  if (kind === "standard_fire") {
    if (snapshot) {
      const target = snapshot.targets.find((t) => t.id === targetId);
      const dist = target
        ? Math.hypot(target.position.x - from.x, target.position.y - from.y)
        : 0;
      const plan = planStandardFire({ ...snapshot, position: from }, dist);
      const mode = fireModeActionLabel(plan.mode, plan.rounds);
      return name ? `${mode}: ${name}` : mode;
    }
    return name ? `攻击: ${name}` : "攻击";
  }
  if (kind === "suppressive_fire") return "压制";
  if (kind === "standard_reload") return "装填";
  if (kind === "standard_aim") return "瞄准";
  if (kind === "throw") return name ? `投掷: ${name}` : "投掷";
  if (kind === "insert") return "插入";
  if (kind === "surrender") return "投降";
  return kind;
}

/** `动作1：移动（(1, 2) → (3, 4)）` / `动作2：标准（攻击: Bot）` for one initiative slot. */
export function formatActorStepActionHint(input: {
  origin: { x: number; y: number };
  actions: readonly HintAction[];
  slot: number;
  stancePositions: readonly { x: number; y: number }[];
  targetIds: readonly (string | null)[];
  targetLabel?: (id: string) => string;
  stayReason?: string;
  snapshot?: CombatSnapshot;
}): string[] {
  const label = input.targetLabel ?? ((id: string) => id);
  let from = input.origin;
  for (const action of input.actions) {
    if (action.round < input.slot) from = movedTo(from, action, input.stancePositions);
  }

  const lines: string[] = [];
  const slotActions = input.actions.filter((action) => action.round === input.slot);
  const stayLine = `不移动：${input.stayReason ?? "移位没有更高分"}`;
  const hasRealMove = slotActions.some((action) => {
    const id = ACTION_KINDS[action.kind];
    if (id !== "move" && id !== "enter_cover") return false;
    const to = movedTo(from, action, input.stancePositions);
    return Math.hypot(to.x - from.x, to.y - from.y) >= 1e-3;
  });
  if (slotActions.length > 0 && !hasRealMove) lines.push(stayLine);
  let index = 0;
  for (const action of input.actions) {
    if (action.round !== input.slot) continue;
    index += 1;
    const kind = ACTION_KINDS[action.kind] ?? "";
    if (kind === "move" || kind === "enter_cover") {
      const to = movedTo(from, action, input.stancePositions);
      if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-3) continue;
      lines.push(`动作${index}：移动（${loc(from)} → ${loc(to)}）`);
      from = to;
      continue;
    }
    if (kind === "leave_cover") {
      lines.push(`动作${index}：自由（离开掩体）`);
      continue;
    }
    lines.push(
      `动作${index}：标准（${standardDetail(kind, action, from, input.targetIds, label, input.snapshot)}）`,
    );
  }
  return lines;
}

/** Current step when this unit is acting; otherwise their next uncompleted plan slot. */
export function actorHintSlot(input: {
  placementId: string;
  turn: { placementId: string; slot: number } | null;
  actions: readonly { round: number }[];
  lastCompletedSlot: number;
}): number | null {
  if (input.turn?.placementId === input.placementId) return input.turn.slot;
  return input.actions.find((action) => action.round > input.lastCompletedSlot)?.round ?? null;
}
