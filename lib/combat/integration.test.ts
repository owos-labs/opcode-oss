import assert from "node:assert/strict";
import { test } from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { compileCombatMap } from "./map-adapter/compile.ts";
import { buildPlanningPayload } from "./build-planning-payload.ts";
import { runCombatCheck } from "./run-check.ts";
import {
  defaultCombatSnapshot,
  exactLocalizationSnapshot,
  loadSimpleMapFixture,
} from "./scenario-fixture.ts";
import { suppressiveFireLegal } from "./actions/suppressive-action.ts";

test("fixture map compiles barriers and vision walls", () => {
  const compiled = compileCombatMap(loadSimpleMapFixture());
  assert.equal(compiled.barriers.length, 2);
  assert.equal(compiled.walls.length, 1);
});

test("buildPlanningPayload marks suppressive and throw when loadout allows", () => {
  const payload = buildPlanningPayload(
    defaultCombatSnapshot(),
    compileCombatMap(loadSimpleMapFixture()),
  );
  assert.ok(suppressiveFireLegal(defaultCombatSnapshot()));
  const suppress = actionKindIndex("suppressive_fire");
  const throwKind = actionKindIndex("throw");
  let hasSuppress = false;
  let hasThrow = false;
  for (let i = 0; i < payload.feasibility.legal.length; i++) {
    if (payload.feasibility.legal[i] !== 1) continue;
    // coarse: at least one legal cell exists for these kinds
  }
  const shape = payload.shape;
  for (let r = 0; r < shape.initiativeRounds; r++) {
    for (let t = 0; t < shape.reachableTiles; t++) {
      for (let g = 0; g < shape.targets; g++) {
        const idx =
          (((r * shape.kinds + suppress) * shape.reachableTiles + t) * shape.targets + g);
        if (payload.feasibility.legal[idx] === 1) hasSuppress = true;
        const idxThrow =
          (((r * shape.kinds + throwKind) * shape.reachableTiles + t) * shape.targets + g);
        if (payload.feasibility.legal[idxThrow] === 1) hasThrow = true;
      }
    }
  }
  assert.equal(hasSuppress, true);
  assert.equal(hasThrow, true);
});

test("full pipeline fixture → plan → recheck", () => {
  const report = runCombatCheck({
    snapshot: defaultCombatSnapshot(),
    map: loadSimpleMapFixture(),
    randomSeed: 99,
  });
  assert.ok(report.legalCellCount > 0);
  assert.equal(report.recheckOk, true);
  assert.equal(report.plan.snapshotVersion, 1);
});

test("exact localization scenario may emit conditional fire timing", () => {
  const report = runCombatCheck({
    snapshot: exactLocalizationSnapshot(),
    map: loadSimpleMapFixture(),
    randomSeed: 1,
  });
  assert.equal(report.recheckOk, true);
  assert.ok(report.plan.actions.length >= 1);
});
