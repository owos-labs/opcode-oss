import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { senseFromSheet } from "./bench-intel.ts";
import {
  buildCombatBenchCoverMarks,
  type CombatBenchCoverMark,
} from "./combat-bench-map-graphics.ts";
import { buildCombatBenchMapOverlay } from "./combat-bench-map-overlay.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";

export type CombatMapPlayOverlayToggles = {
  fov: boolean;
  cover: boolean;
  path: boolean;
};

export const DEFAULT_COMBAT_MAP_PLAY_OVERLAY_TOGGLES: CombatMapPlayOverlayToggles = {
  fov: true,
  cover: true,
  path: true,
};

export type CombatMapPlayOverlayLayers = {
  fovPolygon: readonly { x: number; y: number }[];
  movementDisk: readonly { x: number; y: number }[];
  coverMarks: readonly CombatBenchCoverMark[];
};

export function buildCombatMapPlayOverlay(input: {
  map: CompiledCombatMap;
  placement: CombatMapPlacement;
  placements: readonly CombatMapPlacement[];
  sheet: CharacterSheet | undefined;
}): CombatMapPlayOverlayLayers {
  const sense = senseFromSheet(input.sheet);
  const summary = input.sheet ? readOpcodeSheetSummary(input.sheet.stats, input.sheet.status) : null;
  const overlay = buildCombatBenchMapOverlay({
    map: input.map,
    origin: { x: input.placement.x, y: input.placement.y },
    mov: Math.max(1, summary?.mov ?? 6),
    metersMovedThisRound: 0,
    visionRangeM: sense.openVisionV,
  });
  const coverMarks = buildCombatBenchCoverMarks({
    placements: input.placements,
    barriers: input.map.barriers,
  }).filter((mark) => mark.placementId === input.placement.id);

  return {
    fovPolygon: overlay.visibility,
    movementDisk: overlay.movementDisk,
    coverMarks,
  };
}
