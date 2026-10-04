import assert from "node:assert/strict";
import test from "node:test";

import { colorPickerHex } from "./color-input.ts";

test("colorPickerHex expands short hex and lowercases", () => {
  assert.equal(colorPickerHex("#ABC"), "#aabbcc");
  assert.equal(colorPickerHex("#ff0000"), "#ff0000");
});

test("colorPickerHex falls back for non-hex values", () => {
  assert.equal(colorPickerHex("red", "#111111"), "#111111");
});
