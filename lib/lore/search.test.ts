import assert from "node:assert/strict";
import { test } from "node:test";

import { filterLoreTree } from "./search";
import { buildLoreTree } from "./tree";

const SAMPLE_PATHS = [
  "cn/1.1 简述和角色.md",
  "cn/1.4 建卡指南 By Mira.md",
  "cn/1.7 战斗轮.md",
  "cn/extensions/扩展规则：异能.md",
  "cn/extensions/扩展规则：载具战斗和进阶载具操作.md",
];

const groupLabel = (slug: string) => (slug === "extensions" ? "扩展规则" : slug);

test("filterLoreTree returns the full tree for an empty query", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  assert.deepEqual(filterLoreTree(tree, "", groupLabel), tree);
});

test("filterLoreTree matches chapter titles and keeps extension folders", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  const filtered = filterLoreTree(tree, "建卡", groupLabel);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.type === "page" && filtered[0].title, "1.4 建卡指南 By Mira");
});

test("filterLoreTree matches group labels and nested pages", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  const byGroup = filterLoreTree(tree, "扩展", groupLabel);
  const byPage = filterLoreTree(tree, "载具", groupLabel);

  assert.equal(byGroup.length, 1);
  assert.ok(byGroup[0]?.type === "folder");
  assert.equal(byGroup[0]?.type === "folder" && byGroup[0].children.length, 2);

  assert.equal(byPage.length, 1);
  assert.ok(byPage[0]?.type === "folder");
  assert.equal(byPage[0]?.type === "folder" && byPage[0].children.length, 1);
});
