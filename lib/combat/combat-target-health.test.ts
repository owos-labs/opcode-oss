import assert from "node:assert/strict";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { combatHealthFieldsFromBench } from "./combat-target-health.ts";

test("combatHealthFieldsFromBench exposes normal parts for expectations", () => {
  const sheet: CharacterSheet = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "T",
    created_at: "",
    updated_at: "",
    created_by: "",
    character_id: null,
    rule_book: "Opcode",
    version: "1",
    stats: { stats: { ref: { base: 5 }, int: { base: 5 }, wil: { base: 6 }, chr: { base: 5 }, bod: { base: 5 }, luk: { base: 5 } } },
    status: { health: { mode: "normal" } },
  };
  const fields = combatHealthFieldsFromBench(
    {
      mode: "normal",
      current: 18,
      max: 20,
      parts: {
        head: { current: 2, max: 2 },
        torso: { current: 5, max: 6 },
        hand_primary: { current: 2, max: 2 },
        hand_secondary: { current: 2, max: 2 },
        leg_left: { current: 4, max: 4 },
        leg_right: { current: 3, max: 4 },
      },
    },
    sheet,
  );
  assert.equal(fields.healthMode, "normal");
  assert.equal(fields.parts?.head?.current, 2);
  assert.equal(fields.saveStats?.wil, 6);
});
