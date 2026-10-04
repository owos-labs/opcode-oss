import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_MAP_HISTORY_MAX_STEPS,
  createCombatMapHistory,
  pushCombatMapHistory,
  redoCombatMapHistory,
  undoCombatMapHistory,
} from "./combat-map-history.ts";

test("pushCombatMapHistory keeps at most maxSteps undo levels", () => {
  let history = createCombatMapHistory("v0");
  for (let i = 1; i <= COMBAT_MAP_HISTORY_MAX_STEPS + 5; i++) {
    history = pushCombatMapHistory(history, `v${i}`);
  }
  assert.equal(history.past.length, COMBAT_MAP_HISTORY_MAX_STEPS + 1);
  assert.equal(history.past[0], "v5");
  assert.equal(history.past.at(-1), `v${COMBAT_MAP_HISTORY_MAX_STEPS + 5}`);
});

test("undo and redo restore svg snapshots", () => {
  let history = createCombatMapHistory("a");
  history = pushCombatMapHistory(history, "b");
  history = pushCombatMapHistory(history, "c");

  let undo = undoCombatMapHistory(history);
  assert.equal(undo.svg, "b");
  history = undo.history;

  undo = undoCombatMapHistory(history);
  assert.equal(undo.svg, "a");
  history = undo.history;

  const redo = redoCombatMapHistory(history);
  assert.equal(redo.svg, "b");
  history = redo.history;

  history = pushCombatMapHistory(history, "d");
  assert.deepEqual(history.future, []);
});
