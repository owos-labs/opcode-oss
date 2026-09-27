import assert from "node:assert/strict";
import test from "node:test";

import { reconcileSaveStateAfterAutosaveOff } from "./sheetSaveState";

test("reconcileSaveStateAfterAutosaveOff maps saving to unsaved when dirty", () => {
  assert.equal(reconcileSaveStateAfterAutosaveOff(true, "saving"), "unsaved");
});

test("reconcileSaveStateAfterAutosaveOff leaves saved when clean", () => {
  assert.equal(reconcileSaveStateAfterAutosaveOff(false, "saving"), "saving");
  assert.equal(reconcileSaveStateAfterAutosaveOff(true, "saved"), "saved");
});
