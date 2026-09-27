import assert from "node:assert/strict";
import { test } from "node:test";

import { actorPoint } from "./actor.ts";
import type { CharacterActor } from "./actor.ts";
import { hasLineOfSight } from "./visibility.ts";

test("character actors raycast uses the exact position point", () => {
  const shooter: CharacterActor = { id: "s", position: { x: 0, y: 0 } };
  const target: CharacterActor = { id: "t", position: { x: 4, y: 0 } };
  const wall = [{ a: { x: 2, y: -1 }, b: { x: 2, y: 1 } }];
  assert.equal(hasLineOfSight(actorPoint(shooter), target.position, wall), false);
  assert.equal(hasLineOfSight(actorPoint(shooter), { x: 1.5, y: 0 }, wall), true);
});
