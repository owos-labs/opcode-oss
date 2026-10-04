import assert from "node:assert/strict";
import test from "node:test";

import { cardSurfaceClass } from "./card-surface.ts";

test("shell tone uses content1 layout surface", () => {
  const classes = cardSurfaceClass({ tone: "shell", padding: "none" });
  assert.match(classes, /\bbg-content1\b/);
  assert.doesNotMatch(classes, /\bbg-content3\b/);
});

test("default tone uses raised content3 surface", () => {
  const classes = cardSurfaceClass({ tone: "default" });
  assert.match(classes, /\bbg-content3\b/);
});
