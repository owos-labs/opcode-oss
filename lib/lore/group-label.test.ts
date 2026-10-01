import assert from "node:assert/strict";
import { test } from "node:test";

import { loreGroupLabel } from "./group-label";

test("loreGroupLabel uses i18n for known groups", () => {
  const t = (key: string) => (key === "lore.group.extensions" ? "扩展规则" : key);
  assert.equal(loreGroupLabel("extensions", t), "扩展规则");
  assert.equal(loreGroupLabel("misc", t), "misc");
});
