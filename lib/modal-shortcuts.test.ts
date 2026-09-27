import assert from "node:assert/strict";
import test from "node:test";

import { modalShortcutAction } from "./modal-shortcuts";

test("modalShortcutAction maps Escape to cancel", () => {
  assert.equal(modalShortcutAction("Escape", null), "cancel");
});

test("modalShortcutAction maps Enter to confirm when allowed", () => {
  assert.equal(modalShortcutAction("Enter", null), "confirm");
  assert.equal(modalShortcutAction("Enter", null, { confirmDisabled: true }), null);
});

test("modalShortcutAction ignores Enter in fields when enterFromInputs is false", () => {
  const input = { closest: () => input } as unknown as Element;
  assert.equal(modalShortcutAction("Enter", input, { enterFromInputs: false }), null);
});
