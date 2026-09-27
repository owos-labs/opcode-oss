import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOpcodeDerived,
  createOpcodeSheetForm,
  validateOpcodeSheetForm,
} from "./opcodeSheet.ts";

test("derived weight is 20+10*BOD", () => {
  assert.equal(calculateOpcodeDerived({ ref: 5, int: 5, wil: 5, chr: 5, bod: 5, luk: 5 }).weight, 70);
});

test("empty name fails validation", () => {
  const errors = validateOpcodeSheetForm(createOpcodeSheetForm());
  assert.equal(errors.name, "characterSheets.validation.required");
});
