import assert from "node:assert/strict";
import { test } from "node:test";

import { opcodeSpecializationNameTaken } from "./opcodeSheet.ts";

test("opcodeSpecializationNameTaken ignores case and surrounding space", () => {
  const specs = [{ name: "Urban Survival" }];
  assert.equal(opcodeSpecializationNameTaken(specs, " urban survival "), true);
  assert.equal(opcodeSpecializationNameTaken(specs, "Wilderness"), false);
  assert.equal(opcodeSpecializationNameTaken(specs, "   "), true);
});
