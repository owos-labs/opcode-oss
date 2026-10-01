import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actionLogDetailBody,
  actionLogDetailKind,
  expandReadableActionLogLines,
} from "./combat-bench-action-log-display.ts";

test("actionLogDetailKind treats 选择 lines as reason", () => {
  const line = "选择 直射：火压未达大概率清场 · 本动清≥1人 0.20>直射0.26";
  assert.equal(actionLogDetailKind(line), "reason");
  assert.equal(actionLogDetailBody(line, "reason"), "直射：火压未达大概率清场 · 本动清≥1人 0.20>直射0.26");
});

test("expandReadableActionLogLines keeps difficulty on the target name", () => {
  assert.deepEqual(
    expandReadableActionLogLines("射击 Bot（困难） · 1d10[9]+4=13 vs 15 · 距 10 位 5 掩 0 · 命中"),
    ["Bot（困难） · 1d10[9]+4=13 vs 难度 15", "距离 10 · 定位 5 · 掩体 0", "结果 命中"],
  );
});

test("expandReadableActionLogLines stacks fire check, range parts, and result", () => {
  assert.deepEqual(
    expandReadableActionLogLines("射击 Bot · 1d10[9]+4=13 vs 15 · 距 10 位 5 掩 0 · 命中"),
    ["Bot · 1d10[9]+4=13 vs 难度 15", "距离 10 · 定位 5 · 掩体 0", "结果 命中"],
  );
});

test("expandReadableActionLogLines splits damage amount from armor notes", () => {
  assert.deepEqual(expandReadableActionLogLines("伤害 8 · 穿深 33 / AR 30 · 穿透 · 躯干"), [
    "造成 8",
    "穿深 33 / AR 30 · 穿透 · 躯干",
  ]);
});
