import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileOpcodeMap } from "./map-adapter/compile-opcode-map.ts";
import type { OpcodeMapDocument } from "./map-adapter/opcode-map.types.ts";
import type { CombatMapDto } from "./map-adapter/types.ts";
import type { CombatSnapshot } from "./snapshot.ts";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

export function defaultCombatSnapshot(overrides?: Partial<CombatSnapshot>): CombatSnapshot {
  const base: CombatSnapshot = {
    snapshotVersion: 1,
    barrierVersion: 1,
    actorId: "npc-1",
    position: { x: 0, y: 0 },
    mov: 10,
    attackBonus: 10,
    initiativeTotal: 21,
    initiativeRemaining: 21,
    metersMovedThisRound: 0,
    coverId: null,
    weapon: {
      rangeM: 400,
      rateOfFire: 750,
      accuracy: 0,
      semiAutoOrBetter: true,
    },
    ammo: {
      penetration: 55,
      expectedDamageDice: 3,
      roundsInMagazine: 30,
    },
    sustainedFire: { active: false, walkFireMalus: 0, token: 0 },
    suppressionActive: false,
    targets: [
      {
        id: "hostile-1",
        position: { x: 6, y: 0 },
        localization: "full",
        armorByPart: { torso: 25 },
        coverId: null,
      },
    ],
    encounter: {
      profileId: "trained",
      allowNpcSurrender: false,
      surrenderThreshold: -Infinity,
      mission: "hunt",
    },
    throwable: {
      rangeM: 30,
      expectedDamageDice: 2,
    },
  };
  return { ...base, ...overrides };
}

export function exactLocalizationSnapshot(): CombatSnapshot {
  return defaultCombatSnapshot({
    targets: [
      {
        id: "hostile-1",
        position: { x: 6, y: 0 },
        localization: "exact",
        armorByPart: { torso: 25 },
        coverId: null,
      },
    ],
    encounter: { profileId: "expert", allowNpcSurrender: false, surrenderThreshold: -Infinity, mission: "hunt" },
  });
}

export function loadSimpleMapFixture(): CombatMapDto {
  return JSON.parse(
    readFileSync(join(fixtureDir, "fixtures/simple.json"), "utf8"),
  ) as CombatMapDto;
}

export function loadOpcodeMapAlleyDocument(): OpcodeMapDocument {
  return JSON.parse(
    readFileSync(join(fixtureDir, "fixtures/opcode-map-alley.json"), "utf8"),
  ) as OpcodeMapDocument;
}

export function loadSampleMapSvg(): string {
  return readFileSync(join(fixtureDir, "fixtures/sample-map.svg"), "utf8");
}

export function opcodeMapDocumentFromSampleSvg(): OpcodeMapDocument {
  return {
    name: "sample-map",
    base: { objects: loadSampleMapSvg() },
    runtime: {
      actors: {
        "npc-1": { x: 2, y: 5, team: "friendly" },
        "hostile-1": { x: 8, y: 5, team: "hostile" },
      },
    },
  };
}

/** Snapshot positions aligned with opcode-map-alley.json runtime.actors. */
export function snapshotFromOpcodeMapAlley(
  overrides?: Partial<CombatSnapshot>,
): CombatSnapshot {
  const compiled = compileOpcodeMap(loadOpcodeMapAlleyDocument());
  const npc = compiled.actors["npc-1"]!;
  const hostile = compiled.actors["hostile-1"]!;
  return defaultCombatSnapshot({
    actorId: "npc-1",
    position: { x: npc.x, y: npc.y },
    targets: [
      {
        id: "hostile-1",
        position: { x: hostile.x, y: hostile.y },
        localization: "full",
        armorByPart: { torso: 25 },
        coverId: hostile.coverId,
      },
    ],
    ...overrides,
  });
}
