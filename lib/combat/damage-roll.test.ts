import assert from "node:assert/strict";
import test from "node:test";

import { parseOpcodeDamageExpr, rollOpcodeDamageExpr } from "./damage-roll.ts";

test("parseOpcodeDamageExpr reads dice and flat modifier", () => {
  assert.deepEqual(parseOpcodeDamageExpr("3d6+1"), {
    groups: [{ count: 3, sides: 6 }],
    flatModifier: 1,
  });
  assert.deepEqual(parseOpcodeDamageExpr("2d4-1"), {
    groups: [{ count: 2, sides: 4 }],
    flatModifier: -1,
  });
});

test("rollOpcodeDamageExpr is deterministic with injected rng", () => {
  const faces = [4, 5, 6];
  let i = 0;
  const rng = () => {
    const f = faces[i] ?? 1;
    i++;
    return (f - 1) / 6;
  };
  const rolled = rollOpcodeDamageExpr("3d6+1", rng);
  assert.deepEqual([...rolled.dieFaces], [4, 5, 6]);
  assert.equal(rolled.total, 16);
});

test("rollOpcodeDamageExpr respects maxDice after barrier loss", () => {
  let i = 0;
  const rng = () => {
    i++;
    return 0.5;
  };
  const rolled = rollOpcodeDamageExpr("3d6", rng, 2);
  assert.equal(rolled.dieFaces.length, 2);
});
