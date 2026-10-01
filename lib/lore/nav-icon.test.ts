import assert from "node:assert/strict";
import { test } from "node:test";

import { loreNavIconKind } from "./nav-icon";
import { buildLoreTree } from "./tree";

const SAMPLE_PATHS = [
  "cn/1.1 简述和角色.md",
  "cn/extensions/扩展规则：异能.md",
  "cn/extensions/扩展规则：载具战斗和进阶载具操作.md",
];

test("loreNavIconKind distinguishes chapters, groups, and extensions", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  const chapter = tree.find((node) => node.type === "page");
  const group = tree.find((node) => node.type === "folder");

  assert.ok(chapter?.type === "page");
  assert.equal(loreNavIconKind(chapter), "chapter");

  assert.ok(group?.type === "folder");
  assert.equal(loreNavIconKind(group), "group");
  assert.equal(loreNavIconKind(group.children[0]!), "extension");
});
