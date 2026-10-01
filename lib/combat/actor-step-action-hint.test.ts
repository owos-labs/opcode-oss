import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { actorHintSlot, formatActorStepActionHint } from "./actor-step-action-hint.ts";

test("formatActorStepActionHint lists the slot as move and standard lines", () => {
  assert.deepEqual(
    formatActorStepActionHint({
      origin: { x: 10.2, y: 4.4 },
      slot: 0,
      stancePositions: [
        { x: 10.2, y: 4.4 },
        { x: 18.6, y: 9.1 },
      ],
      targetIds: [null, "bot"],
      targetLabel: () => "Bot",
      actions: [
        { round: 0, kind: actionKindIndex("move"), tile: 1, target: 0 },
        { round: 0, kind: actionKindIndex("standard_fire"), tile: 1, target: 1 },
        { round: 1, kind: actionKindIndex("leave_cover"), tile: 0, target: 0 },
      ],
    }),
    ["动作1：移动（(10, 4) → (19, 9)）", "动作2：标准（攻击: Bot）"],
  );
});

test("formatActorStepActionHint starts the next slot from the earlier move", () => {
  assert.deepEqual(
    formatActorStepActionHint({
      origin: { x: 0, y: 0 },
      slot: 1,
      stancePositions: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 8, y: 2 },
      ],
      targetIds: [null],
      actions: [
        { round: 0, kind: actionKindIndex("move"), tile: 1, target: 0 },
        { round: 1, kind: actionKindIndex("enter_cover"), tile: 2, target: 0 },
        { round: 1, kind: actionKindIndex("leave_cover"), tile: 0, target: 0 },
      ],
    }),
    ["动作1：移动（(5, 0) → (8, 2)）", "动作2：自由（离开掩体）"],
  );
});

test("actorHintSlot prefers the active turn, else the next unfinished slot", () => {
  const actions = [{ round: 0 }, { round: 1 }];
  assert.equal(
    actorHintSlot({
      placementId: "a",
      turn: { placementId: "a", slot: 1 },
      actions,
      lastCompletedSlot: 0,
    }),
    1,
  );
  assert.equal(
    actorHintSlot({
      placementId: "b",
      turn: { placementId: "a", slot: 1 },
      actions,
      lastCompletedSlot: -1,
    }),
    0,
  );
});
