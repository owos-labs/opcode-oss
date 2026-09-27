/**
 * Terminal-only combat pipeline check (Phase 2). Not a UI — prints JSON summary.
 *
 * Usage: pnpm combat:check
 *        pnpm combat:check -- --scenario exact
 *        pnpm combat:check -- --map opcode
 *        pnpm combat:check -- --map svg
 *        pnpm combat:check -- --character lib/combat/fixtures/test-chr.json
 *        pnpm combat:check -- --character   (defaults to test-chr fixture)
 *        pnpm combat:check -- --character path.json --rounds 30
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { combatSnapshotFromCharacterSheet } from "../lib/combat/character-sheet-snapshot.ts";
import { loadCharacterSheetFromFile } from "../lib/combat/load-character-sheet-file.ts";
import { compileOpcodeMap } from "../lib/combat/map-adapter/compile-opcode-map.ts";
import {
  defaultCombatSnapshot,
  exactLocalizationSnapshot,
  loadOpcodeMapAlleyDocument,
  loadSimpleMapFixture,
  opcodeMapDocumentFromSampleSvg,
  snapshotFromOpcodeMapAlley,
} from "../lib/combat/scenario-fixture.ts";
import { runCombatCheck, runCombatCheckAfterBarrierBump } from "../lib/combat/run-check.ts";
import type { CombatSnapshot } from "../lib/combat/snapshot.ts";
import type { CharacterSheet } from "../lib/character-sheets/characterSheet.types.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCharacterFixture = join(repoRoot, "lib/combat/fixtures/test-chr.json");

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

const scenario = argValue("--scenario") ?? "default";
const mapMode = argValue("--map") ?? "simple";
const characterFlagIndex = process.argv.indexOf("--character");
const characterPath =
  characterFlagIndex >= 0
    ? argValue("--character") ?? defaultCharacterFixture
    : undefined;
const roundsOverrideRaw = argValue("--rounds");
const roundsOverride =
  roundsOverrideRaw !== undefined ? Number(roundsOverrideRaw) : undefined;

const svgDoc = opcodeMapDocumentFromSampleSvg();

const defaultHostile = {
  id: "hostile-1",
  localization: "full" as const,
  armorByPart: { torso: 25 },
  coverId: null as string | null,
};

function snapshotForMap(characterSheet?: CharacterSheet): CombatSnapshot {
  if (characterSheet) {
    const position =
      mapMode === "opcode"
        ? (() => {
            const compiled = compileOpcodeMap(loadOpcodeMapAlleyDocument());
            const npc = compiled.actors["npc-1"]!;
            return { x: npc.x, y: npc.y, coverId: npc.coverId ?? null };
          })()
        : mapMode === "svg"
          ? {
              x: svgDoc.runtime!.actors!["npc-1"]!.x,
              y: svgDoc.runtime!.actors!["npc-1"]!.y,
              coverId: null as string | null,
            }
          : { x: 0, y: 0, coverId: null as string | null };

    const hostilePos =
      mapMode === "opcode"
        ? (() => {
            const compiled = compileOpcodeMap(loadOpcodeMapAlleyDocument());
            const h = compiled.actors["hostile-1"]!;
            return { x: h.x, y: h.y, coverId: h.coverId ?? null };
          })()
        : mapMode === "svg"
          ? {
              x: svgDoc.runtime!.actors!["hostile-1"]!.x,
              y: svgDoc.runtime!.actors!["hostile-1"]!.y,
              coverId: null as string | null,
            }
          : { x: 6, y: 0, coverId: null as string | null };

    let snapshot = combatSnapshotFromCharacterSheet(characterSheet, {
      actorId: characterSheet.id,
      position: { x: position.x, y: position.y },
      coverId: position.coverId,
      targets: [
        {
          ...defaultHostile,
          position: { x: hostilePos.x, y: hostilePos.y },
          coverId: hostilePos.coverId,
        },
      ],
      encounter:
        scenario === "exact"
          ? { profileId: "expert", allowNpcSurrender: false, surrenderThreshold: -Infinity }
          : undefined,
    });

    if (scenario === "exact") {
      snapshot = {
        ...snapshot,
        targets: snapshot.targets.map((t) => ({ ...t, localization: "exact" as const })),
      };
    }

    if (roundsOverride !== undefined && Number.isFinite(roundsOverride) && roundsOverride >= 0) {
      snapshot = {
        ...snapshot,
        ammo: { ...snapshot.ammo, roundsInMagazine: Math.floor(roundsOverride) },
      };
    }

    return snapshot;
  }

  if (scenario === "exact") return exactLocalizationSnapshot();
  if (mapMode === "opcode") return snapshotFromOpcodeMapAlley();
  if (mapMode === "svg") {
    return defaultCombatSnapshot({
      position: { x: svgDoc.runtime!.actors!["npc-1"]!.x, y: svgDoc.runtime!.actors!["npc-1"]!.y },
      targets: [
        {
          ...defaultHostile,
          position: {
            x: svgDoc.runtime!.actors!["hostile-1"]!.x,
            y: svgDoc.runtime!.actors!["hostile-1"]!.y,
          },
        },
      ],
    });
  }
  return defaultCombatSnapshot();
}

const characterSheet = characterPath ? loadCharacterSheetFromFile(characterPath) : undefined;
const snapshot = snapshotForMap(characterSheet);

const map =
  mapMode === "opcode"
    ? compileOpcodeMap(loadOpcodeMapAlleyDocument())
    : mapMode === "svg"
      ? compileOpcodeMap(svgDoc)
      : loadSimpleMapFixture();

const report = runCombatCheck({ snapshot, map, randomSeed: 42 });
const bump = runCombatCheckAfterBarrierBump(
  { snapshot, map, randomSeed: 42 },
  { barrierVersion: snapshot.barrierVersion + 1 },
);

const out: Record<string, unknown> = {
  scenario,
  mapMode,
  mapId: report.mapId,
  legalCellCount: report.legalCellCount,
  plan: {
    snapshotVersion: report.plan.snapshotVersion,
    randomSeed: report.plan.randomSeed,
    actionCount: report.plan.actions.length,
    actions: report.plan.actions,
    totalUtility: report.plan.totalUtility,
    timedOut: report.plan.timedOut,
  },
  recheckOk: report.recheckOk,
  conditionalIntents: report.conditionalIntents,
  barrierBumpRecheck: bump.afterVersionRecheck,
};

if (characterSheet) {
  out.character = {
    path: characterPath,
    id: characterSheet.id,
    name: characterSheet.name,
    mov: snapshot.mov,
    weaponRangeM: snapshot.weapon.rangeM,
    roundsInMagazine: snapshot.ammo.roundsInMagazine,
  };
}

console.log(JSON.stringify(out, null, 2));
process.exit(report.recheckOk ? 0 : 1);
