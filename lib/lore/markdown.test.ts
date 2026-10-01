import assert from "node:assert/strict";
import { test } from "node:test";

import { loreMetaLabelKey, parseMarkdownFrontmatter, stripMarkdownFrontmatter } from "./markdown";

test("parseMarkdownFrontmatter splits YAML metadata from body", () => {
  const source = `---
by: "\\"SuperKitty\\" MKKO"
last_updated: 08/26/2026
---

# Title

Body text.`;

  const parsed = parseMarkdownFrontmatter(source);
  assert.equal(parsed.frontmatter.by, '"SuperKitty" MKKO');
  assert.equal(parsed.frontmatter.last_updated, "08/26/2026");
  assert.equal(parsed.content, "# Title\n\nBody text.");
});

test("stripMarkdownFrontmatter returns body only", () => {
  const source = `---
by: MKKO
---

# Title`;

  assert.equal(stripMarkdownFrontmatter(source), "# Title");
});

test("parseMarkdownFrontmatter leaves content without frontmatter unchanged", () => {
  const source = "# Title\n\nNo frontmatter here.";
  const parsed = parseMarkdownFrontmatter(source);
  assert.deepEqual(parsed.frontmatter, {});
  assert.equal(parsed.content, source);
});

test("loreMetaLabelKey maps known frontmatter keys", () => {
  assert.equal(loreMetaLabelKey("by"), "lore.meta.by");
  assert.equal(loreMetaLabelKey("last_updated"), "lore.meta.lastUpdated");
  assert.equal(loreMetaLabelKey("custom"), "custom");
});
