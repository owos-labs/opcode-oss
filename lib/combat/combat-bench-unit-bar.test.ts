import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeBenchUnitBarRows,
  turnStepsForPlacement,
} from "./combat-bench-unit-bar.ts";

const viewA = {
  placementId: "a",
  label: "A",
  team: "hostile",
} as never;

const viewB = {
  placementId: "b",
  label: "B",
  team: "friendly",
} as never;

test("turnStepsForPlacement keeps flat indices for highlighting", () => {
  const seq = [
    { placementId: "a", label: "A", slot: 0, isDecider: true },
    { placementId: "b", label: "B", slot: 0, isDecider: false },
    { placementId: "a", label: "A", slot: 1, isDecider: true },
  ];
  assert.deepEqual(turnStepsForPlacement(seq, "a").map((x) => x.flatIndex), [0, 2]);
  assert.equal(turnStepsForPlacement(seq, "b").length, 1);
});

test("mergeBenchUnitBarRows dedupes duplicate order entries", () => {
  const merged = mergeBenchUnitBarRows(
    [
      {
        placementId: "a",
        label: "A",
        team: "hostile",
        initiativePool: 30,
        profileId: "trained",
        isDecider: true,
        ref: 6,
        initiativeBonus: 0,
        d10Faces: [4],
        roll: 10,
      },
      {
        placementId: "a",
        label: "A",
        team: "hostile",
        initiativePool: 30,
        profileId: "trained",
        isDecider: true,
        ref: 6,
        initiativeBonus: 0,
        d10Faces: [4],
        roll: 10,
      },
    ],
    [viewA],
  );
  assert.equal(merged.length, 1);
});

test("mergeBenchUnitBarRows follows initiative order then extras", () => {
  const merged = mergeBenchUnitBarRows(
    [
      {
        placementId: "b",
        label: "B",
        team: "friendly",
        initiativePool: 30,
        profileId: "trained",
        isDecider: false,
        ref: 5,
        initiativeBonus: 0,
        d10Faces: [3],
        roll: 8,
      },
      {
        placementId: "a",
        label: "A",
        team: "hostile",
        initiativePool: 30,
        profileId: "trained",
        isDecider: true,
        ref: 6,
        initiativeBonus: 0,
        d10Faces: [4],
        roll: 10,
      },
    ],
    [viewA, viewB],
  );
  assert.deepEqual(
    merged.map((r) => [r.view.placementId, r.initiativeRank]),
    [
      ["b", 1],
      ["a", 2],
    ],
  );
});
