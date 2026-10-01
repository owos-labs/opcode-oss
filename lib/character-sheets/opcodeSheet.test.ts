import assert from "node:assert/strict";
import { test } from "node:test";

import { calculateOpcodeDerived, opcodeSpecializationNameTaken } from "./opcodeSheet.ts";

test("calculateOpcodeDerived mov is 1.75*REF + 1.25*BOD rounded", () => {
  assert.equal(
    calculateOpcodeDerived({ ref: 5, int: 5, wil: 5, chr: 5, bod: 5, luk: 5 }).mov,
    15,
  );
  assert.equal(
    calculateOpcodeDerived({ ref: 10, int: 4, wil: 6, chr: 1, bod: 8, luk: 2 }).mov,
    28,
  );
});

test("opcodeSpecializationNameTaken ignores case and surrounding space", () => {
  const specs = [{ name: "Urban Survival" }];
  assert.equal(opcodeSpecializationNameTaken(specs, " urban survival "), true);
  assert.equal(opcodeSpecializationNameTaken(specs, "Wilderness"), false);
  assert.equal(opcodeSpecializationNameTaken(specs, "   "), true);
});
