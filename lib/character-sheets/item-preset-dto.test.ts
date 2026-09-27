import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeItemPresetDto, stripBaseModelFromDesc } from "./item-preset-dto.ts";

test("stripBaseModelFromDesc removes parenthetical base model lines", () => {
  assert.equal(
    stripBaseModelFromDesc("短管步枪。（基础型号：M4A1）"),
    "短管步枪。",
  );
  assert.equal(
    stripBaseModelFromDesc("Line one\n\n（基础型号：Glock 17）"),
    "Line one",
  );
});

test("normalizeItemPresetDto stores Chinese desc as locale map", () => {
  const next = normalizeItemPresetDto({
    id: "x",
    name: "Test",
    type: "weapon",
    desc: "短管步枪",
  });
  assert.deepEqual(next.desc, { zh: "短管步枪" });
});

test("normalizeItemPresetDto drops base_model without copying into desc", () => {
  const next = normalizeItemPresetDto({
    id: "x",
    name: "Test",
    kind: "generic",
    desc: "Plain desc.",
    base_model: "Real Product Name",
  });
  assert.deepEqual(next.desc, { en: "Plain desc." });
  assert.equal("base_model" in next, false);
});
