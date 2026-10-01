import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildLoreTree,
  firstLoreSlug,
  loreHref,
  loreNodeActive,
  loreSlugFromParams,
  loreTitleFromFilename,
} from "./tree";

const SAMPLE_PATHS = [
  "LICENSE",
  "README.md",
  "cn/README.md",
  "cn/1.1 简述和角色.md",
  "cn/1.2 技能.md",
  "cn/extensions/扩展规则：异能.md",
  "en/1.1 Intro & Character Creation.md",
];

test("buildLoreTree skips README and builds nested folders", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  assert.equal(tree.length, 3);
  assert.equal(tree[0]?.type, "page");
  assert.equal(tree[0]?.type === "page" && tree[0].slug, "1.1 简述和角色");

  const extensions = tree.find((node) => node.type === "folder" && node.slug === "extensions");
  assert.ok(extensions?.type === "folder");
  assert.equal(extensions.children.length, 1);
  assert.equal(extensions.children[0]?.type === "page" && extensions.children[0].slug, "extensions/扩展规则：异能");
});

test("firstLoreSlug returns the first page in chapter order", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  assert.equal(firstLoreSlug(tree), "1.1 简述和角色");
});

test("loreHref and loreSlugFromParams round-trip encoded slugs", () => {
  const slug = "extensions/扩展规则：异能";
  const href = loreHref(slug);
  assert.equal(href, "/lore/extensions/%E6%89%A9%E5%B1%95%E8%A7%84%E5%88%99%EF%BC%9A%E5%BC%82%E8%83%BD");
  assert.equal(loreSlugFromParams(["extensions", "扩展规则：异能"]), slug);
});

test("loreTitleFromFilename strips markdown extension", () => {
  assert.equal(loreTitleFromFilename("1.2 技能.md"), "1.2 技能");
});

test("loreNodeActive matches nested folder descendants", () => {
  const tree = buildLoreTree(SAMPLE_PATHS, "cn");
  const extensions = tree.find((node) => node.type === "folder");
  assert.ok(extensions);
  const href = loreHref("extensions/扩展规则：异能");
  assert.equal(loreNodeActive(extensions, href), true);
  assert.equal(loreNodeActive(extensions, "/lore/1.1%20简述"), false);
});
