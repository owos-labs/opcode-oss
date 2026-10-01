import assert from "node:assert/strict";
import test from "node:test";

import {
  compactActionLogDetailLine,
  compactActionLogDetailLines,
  compactActionLogStepSummary,
} from "./combat-bench-action-log-compact.ts";

test("compactPlanActionLine shortens move and fire intents", () => {
  assert.equal(
    compactActionLogDetailLine(
      "R1 move→ (15.4, 19.8) m · immediate",
    ),
    "移动 (15, 20) · 即时",
  );
  assert.equal(
    compactActionLogDetailLine(
      "R1 standard_fire→ (15.4, 19.8) m @ Bot · immediate",
    ),
    "射→(15,20)@Bot · 即时",
  );
  assert.equal(
    compactActionLogDetailLine("R1 suppressive_fire · immediate"),
    "压制 · 即时",
  );
  assert.equal(compactActionLogDetailLine("压制 耗弹30 剩0"), "耗弹 30 · 剩 0");
});

test("compactActionLogDetailLine keeps a vision line intact", () => {
  const line =
    "视野 Alpha 完全 · Bravo 精确 · Charlie 未见 · Delta 完全 · Echo 精确 · Foxtrot 未见";
  assert.equal(compactActionLogDetailLine(line), line);
});

test("compactFireLines keep the attack check breakdown", () => {
  assert.equal(
    compactActionLogDetailLine(
      "对 Bot 射击检定：1d10[9]+4专精+3技能+6属性-3惩罚（连续射击）=19 vs 难度15(距10+位5+掩0) → 命中",
    ),
    "射击 Bot · 1d10[9]+4专精+3技能+6属性-3惩罚（连续射击）=19 vs 15 · 距 10 位 5 掩 0 · 命中",
  );
  assert.equal(
    compactActionLogDetailLine(
      "对 T 射击检定：1d10[1]+6属性=7 vs 难度10(距0+位0+掩0) → 未中",
    ),
    "射击 T · 1d10[1]+6属性=7 vs 10 · 未中",
  );
});

test("compactFireLines shorten attack and damage", () => {
  assert.equal(
    compactActionLogDetailLine(
      "对 Bot 射击检定：[10]+6=16 vs 难度15(距10+位5+掩0) → 命中",
    ),
    "射击 Bot · 16 vs 15 · 距 10 位 5 掩 0 · 命中",
  );
  assert.equal(
    compactActionLogDetailLine(
      "对 T 射击检定：[1]+0=1 vs 难度10(距5+位3+掩2) → 未中",
    ),
    "射击 T · 1 vs 10 · 距 5 位 3 掩 2 · 未中",
  );
  assert.equal(
    compactActionLogDetailLine(
      "伤害 3d6 | 基3骰 挡-1骰→2骰 穿45/AR10 穿透 掷2骰 → [2+4+1]=7 Bot剩12",
    ),
    "伤害 7 · 挡 1 骰 · 穿深 45 / AR 10 · 穿 · 剩 HP 12",
  );
  assert.equal(
    compactActionLogDetailLine(
      "伤害 3d6 | 基3骰 挡-0骰→3骰 穿55/AR10 位左腿 穿透 掷3骰 → [3+3+3]=9 T剩11",
    ),
    "伤害 9 · 穿深 55 / AR 10 · 穿 · 左腿 · 剩 HP 11",
  );
  assert.equal(
    compactActionLogDetailLine(
      "伤害 3d6 | 基3骰 挡-0骰→3骰 穿33/AR0 穿透 掷3骰 → [6+6+6]=18 简易×2 T剩2",
    ),
    "伤害 18 · 穿深 33 · 穿 · ×2 · 剩 HP 2",
  );
});

test("compactActionLogDetailLines drops redundant plan fire when outcome present", () => {
  assert.deepEqual(
    compactActionLogDetailLines([
      "R1 move→ (35.0, 23.0) m · immediate",
      "R1 standard_fire→ (35.0, 23.0) m @ 2b274000 · immediate",
      "对 Untitled 射击检定：[8]+8=16 vs 难度15(距15+位0+掩0) → 命中",
      "伤害 3d6 | 基3骰 挡-0骰→3骰 穿33/AR0 过穿减骰 掷3骰 → [2+2+2]=6 Untitled剩13",
    ]),
    [
      "移动 (35, 23) · 即时",
      "射击 Untitled · 16 vs 15 · 命中",
      "伤害 6 · 穿深 33 · 过穿 · 剩 HP 13",
    ],
  );
});

test("compactActionLogStepSummary uses turn slot not full label", () => {
  assert.equal(
    compactActionLogStepSummary({
      label: "A · 移动 1m · 对 T 射击…",
      turn: { label: "A", slot: 0 },
    }),
    "A · 段 1",
  );
  assert.equal(
    compactActionLogStepSummary({
      label: "进入第 2 战斗轮 · B · …",
      turn: { label: "B", slot: 1 },
      enteredNewCombatRound: 2,
    }),
    "进第 2 轮 · B · 段 2",
  );
});
