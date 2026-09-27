import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEmplacementTargetVis,
  coverHeightBandForEmplacement,
  coverToggleCost,
  localizationFromSight,
} from "./cover-concealment-view.ts";

test("coverToggleCost distinguishes half-body vs full-body emplacements", () => {
  assert.deepEqual(coverToggleCost("half_body"), { freeAction: true, movementAction: true });
  assert.deepEqual(coverToggleCost("full_body"), { freeAction: false, movementAction: true });
  assert.equal(coverHeightBandForEmplacement("half_body"), "half");
  assert.equal(coverHeightBandForEmplacement("full_body"), "full");
});

test("localizationFromSight maps LOS and boundary to D10 levels", () => {
  assert.equal(localizationFromSight(true, true), "full");
  assert.equal(localizationFromSight(false, true), "exact");
  assert.equal(localizationFromSight(false, false), "approximate");
});

test("buildEmplacementTargetVis runs only after observer uses the emplacement", () => {
  const emplacement = {
    id: "bags",
    emplacement: "half_body" as const,
    distanceToEnter: 1.5,
  };
  const off = buildEmplacementTargetVis({
    emplacement,
    observer: { x: 0, y: 0 },
    observerUsesCover: false,
    targets: [{ id: "t", position: { x: 5, y: 0 } }],
    targetCoverId: { t: null },
    boundary: { visibleIds: ["t"] },
  });
  assert.equal(off.enabled, false);
  assert.deepEqual(off.targetVis, ["approximate"]);

  const on = buildEmplacementTargetVis({
    emplacement,
    observer: { x: 0, y: 0 },
    observerUsesCover: true,
    targets: [
      { id: "peer", position: { x: 1, y: 0 } },
      { id: "open", position: { x: 8, y: 0 } },
    ],
    targetCoverId: { peer: "bags", open: null },
    boundary: { visibleIds: ["peer", "open"] },
  });
  assert.equal(on.enabled, true);
  assert.equal(on.distance, 1.5);
  assert.equal(on.targetVis[0], "exact");
  assert.equal(on.targetVis[1], "full");
});

test("full-body emplacement blocks full localization without LOS", () => {
  const wall = [{ a: { x: 6, y: -1 }, b: { x: 6, y: 1 } }];
  const slice = buildEmplacementTargetVis({
    emplacement: {
      id: "bunker",
      emplacement: "full_body",
      distanceToEnter: 2,
    },
    observer: { x: 0, y: 0 },
    observerUsesCover: true,
    targets: [{ id: "hidden", position: { x: 10, y: 0 } }],
    targetCoverId: { hidden: null },
    boundary: { visibleIds: ["hidden"] },
    walls: wall,
  });
  assert.equal(slice.targetVis[0], "exact");
});
