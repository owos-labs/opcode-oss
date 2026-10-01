import assert from "node:assert/strict";
import test from "node:test";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import {
  rangedShooterAttackBonus,
  rangedShooterAttackParts,
  weaponSpecializationMatches,
} from "./ranged-shooter-bonus.ts";

test("weaponSpecializationMatches links rifle wire to Assault Rifles preset", () => {
  assert.equal(
    weaponSpecializationMatches("marksmanship", "assaultRifles", "Assault Rifles"),
    true,
  );
});

test("rangedShooterAttackParts adds specialization roll bonus", () => {
  const sheet = {
    id: "s1",
    stats: {
      stats: {
        ref: { base: 6, mod: 0 },
        int: { base: 0, mod: 0 },
        wil: { base: 0, mod: 0 },
        chr: { base: 0, mod: 0 },
        bod: { base: 0, mod: 0 },
        luk: { base: 0, mod: 0 },
      },
      derivated: { health: { mode: "simple", simple: { base: 10, mod: 0 } } },
      skills: {
        base: {
          marksmanship: {
            base: 3,
            mod: 0,
            stat: ["ref"],
            specialization: { assaultRifles: { base: 2, mod: 0 } },
          },
        },
      },
    },
    status: {},
  } as unknown as CharacterSheet;

  const parts = rangedShooterAttackParts(sheet, [
    {
      name: "marksmanship",
      mul: "1",
      specializations: [{ name: "assaultRifles", mul: "2" }],
    },
  ]);

  assert.equal(parts.linkedStat, 6);
  assert.equal(parts.skillLevel, 3);
  assert.equal(parts.specializationBonus, 4);
  assert.equal(rangedShooterAttackBonus(parts, 0), 13);
});
