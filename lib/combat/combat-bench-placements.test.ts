import assert from "node:assert/strict";
import test from "node:test";

import {
  benchStartValidation,
  nextDefaultTeam,
  normalizeTeamId,
  teamColorIndex,
} from "./combat-bench-placements.ts";

test("nextDefaultTeam fills hostile then friendly then numbered teams", () => {
  assert.equal(nextDefaultTeam([]), "hostile");
  assert.equal(
    nextDefaultTeam([{ id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" }]),
    "friendly",
  );
  assert.equal(
    nextDefaultTeam([
      { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" },
      { id: "b", sheetId: "s", label: "B", x: 1, y: 0, team: "friendly" },
    ]),
    "team-3",
  );
});

test("normalizeTeamId rejects blank names", () => {
  assert.equal(normalizeTeamId("  red  "), "red");
  assert.equal(normalizeTeamId("   "), null);
});

test("teamColorIndex keeps hostile/friendly stable and hashes others", () => {
  assert.equal(teamColorIndex("hostile"), 0);
  assert.equal(teamColorIndex("friendly"), 1);
  assert.notEqual(teamColorIndex("alpha"), teamColorIndex("hostile"));
});

test("benchStartValidation allows a single bot", () => {
  assert.equal(
    benchStartValidation([{ id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" }], "a")
      .ok,
    true,
  );
});

test("benchStartValidation requires two factions", () => {
  const same = [
    { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" },
    { id: "b", sheetId: "s", label: "B", x: 1, y: 0, team: "hostile" },
  ];
  assert.equal(benchStartValidation(same, "a").ok, false);
  if (!benchStartValidation(same, "a").ok) {
    assert.equal(benchStartValidation(same, "a").reason, "need_two_factions");
  }
  assert.equal(
    benchStartValidation(
      [
        { id: "a", sheetId: "s", label: "A", x: 0, y: 0, team: "hostile" },
        { id: "b", sheetId: "s", label: "B", x: 1, y: 0, team: "alpha" },
      ],
      "a",
    ).ok,
    true,
  );
});
