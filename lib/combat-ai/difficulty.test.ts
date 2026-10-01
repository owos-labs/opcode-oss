import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NPC_AI_DEADLINE_MS,
  NPC_AI_WALL_MS,
  NPC_DIFFICULTY_LABELS,
  NPC_DIFFICULTY_PROFILES,
  formatUnitDifficultyName,
  getNpcDifficultyProfile,
  isExpertTierCore,
} from "./difficulty.ts";

test("NPC AI wall clock budget leaves glue time under 5s", () => {
  assert.equal(NPC_AI_WALL_MS, 5000);
  assert.ok(NPC_AI_DEADLINE_MS < NPC_AI_WALL_MS);
});

test("newstupid is single move xor standard without cover", () => {
  const p = getNpcDifficultyProfile("newstupid");
  assert.equal(p.actionShape, "move_xor_standard");
  assert.equal(p.singleActionMoveXorStandard, true);
  assert.equal(p.considersCover, false);
  assert.equal(p.considersArmorPenetration, false);
  assert.equal(p.considersActionEconomy, false);
  assert.equal(p.maxInitiativeRounds, 0);
});

test("novice is dual action with cover and no action economy", () => {
  const p = getNpcDifficultyProfile("novice");
  assert.equal(p.actionShape, "dual_free");
  assert.equal(p.considersCover, true);
  assert.equal(p.considersArmorPenetration, true);
  assert.equal(p.considersActionEconomy, false);
  assert.equal(p.allowsInsertedActions, false);
});

test("trained fills up to two initiative rounds with economy and inserts", () => {
  const p = getNpcDifficultyProfile("trained");
  assert.equal(p.considersActionEconomy, true);
  assert.equal(p.maxInitiativeRounds, 2);
  assert.equal(p.allowsInsertedActions, true);
  assert.equal(p.considersCoverThickness, true);
  assert.equal(p.allowsLocatedShotThroughCover, true);
});

test("novice ignores cover thickness and located shot through cover", () => {
  const p = getNpcDifficultyProfile("novice");
  assert.equal(p.considersCoverThickness, false);
  assert.equal(p.allowsLocatedShotThroughCover, false);
});

test("expert and professional keep action-economy caps without lethality search fields", () => {
  const p = getNpcDifficultyProfile("expert");
  assert.ok(isExpertTierCore(p));
  assert.equal(p.maxInitiativeRounds, "all");
  const pro = getNpcDifficultyProfile("professional");
  assert.ok(isExpertTierCore(pro));
  assert.equal(pro.maxInitiativeRounds, "all");
});

test("all five difficulty ids are defined", () => {
  const ids = ["newstupid", "novice", "trained", "expert", "professional"] as const;
  assert.equal(Object.keys(NPC_DIFFICULTY_PROFILES).length, ids.length);
  for (const id of ids) assert.equal(NPC_DIFFICULTY_PROFILES[id].id, id);
});

test("difficulty labels use 简单 / 普通 / 困难", () => {
  assert.equal(NPC_DIFFICULTY_LABELS.newstupid, "简单");
  assert.equal(NPC_DIFFICULTY_LABELS.novice, "普通");
  assert.equal(NPC_DIFFICULTY_LABELS.trained, "困难");
  assert.equal(formatUnitDifficultyName("Bot", "trained"), "Bot（困难）");
});
