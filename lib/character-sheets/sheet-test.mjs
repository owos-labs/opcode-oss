import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOpcodeDerived,
  createOpcodeSheetForm,
  validateOpcodeSheetForm,
} from "./opcodeSheet.ts";

test("derived weight is 20+10*BOD", () => {
  const derived = calculateOpcodeDerived({ ref: 5, int: 5, wil: 5, chr: 5, bod: 5, luk: 5 });
  assert.equal(derived.weight, 70);
  assert.equal(derived.mov, 15);
});

test("empty name fails validation", () => {
  const errors = validateOpcodeSheetForm(createOpcodeSheetForm());
  assert.equal(errors.name, "characterSheets.validation.required");
});
