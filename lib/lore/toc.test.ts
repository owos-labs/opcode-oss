import assert from "node:assert/strict";
import { test } from "node:test";

import { getLoreTableOfContents } from "./toc";

test("getLoreTableOfContents extracts nested heading anchors", async () => {
  const toc = await getLoreTableOfContents(`## 载具战斗

### 新技能

正文。`);

  assert.equal(toc.length, 2);
  assert.equal(toc[0]?.title, "载具战斗");
  assert.equal(toc[0]?.url, "#载具战斗");
  assert.equal(toc[1]?.depth, 3);
});
