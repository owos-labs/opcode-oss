import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { ScoredActionOption } from "../combat-ai/planning.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import { topScoredOptionRows } from "./combat-bench-top-options.ts";

test("topScoredOptionRows returns highest utility first", () => {
  const payload = {
    stancePositions: [{ x: 0, y: 0 }],
    targetIds: [null, "t1"],
  } as PlanningPayload;
  const options: ScoredActionOption[] = [
    {
      round: 0,
      kind: actionKindIndex("move"),
      tile: 0,
      target: 0,
      utility: 1,
      utilityUpperBound: 1,
      kindId: "move",
      timing: "immediate",
    },
    {
      round: 0,
      kind: actionKindIndex("standard_fire"),
      tile: 0,
      target: 1,
      utility: 9,
      utilityUpperBound: 9,
      kindId: "standard_fire",
      timing: "immediate",
    },
  ];
  const rows = topScoredOptionRows(payload, options, 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.utility, 9);
  assert.match(rows[0]!.text, /standard_fire/);
});
