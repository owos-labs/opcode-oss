import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeInventory } from "../character-sheets/opcodeInventory.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { NPC_DIFFICULTY_LABELS, type NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import { placementProfileId } from "./combat-bench-initiative.ts";
import {
  benchHealthFromSheet,
  type BenchHealthView,
} from "./combat-bench-health.ts";
import type { CombatBenchSession } from "./combat-bench.ts";
import {
  combatSnapshotFromCharacterSheet,
  estimateInitiativePool,
  selectPrimaryRangedWeapon,
} from "./character-sheet-snapshot.ts";
import { senseFromSheet } from "./bench-intel.ts";
import type { CombatAmmoView, CombatSnapshot, CombatWeaponView } from "./snapshot.ts";

export type CombatBenchUnitStatusView = {
  placementId: string;
  label: string;
  team: CombatMapPlacement["team"];
  profileId: NpcDifficultyId;
  profileLabel: string;
  isDecider: boolean;
  isSelected: boolean;
  position: { x: number; y: number };
  health: BenchHealthView | null;
  weaponName: string | null;
  weaponCaliber: string | null;
  weapon: CombatWeaponView | null;
  ammo: CombatAmmoView | null;
  mov: number | null;
  initiativeRemaining: number | null;
  initiativeTotal: number | null;
  metersMovedThisRound: number | null;
  suppressionActive: boolean;
  sustainedFireActive: boolean;
  hasLiveSnapshot: boolean;
  hearingA: number;
  openVisionV: number;
  passiveS: number;
};

function snapshotForPlacement(input: {
  sheet: CharacterSheet;
  placement: CombatMapPlacement;
  placements: readonly CombatMapPlacement[];
  session: CombatBenchSession | null | undefined;
}): CombatSnapshot | null {
  const live = input.session?.plansByPlacementId[input.placement.id]?.snapshot;
  if (live) return live;
  try {
    const targets = input.placements
      .filter((p) => p.id !== input.placement.id)
      .map((p) => ({
        id: p.id,
        position: { x: p.x, y: p.y },
        localization: "approximate" as const,
        armorByPart: { torso: 0 },
        coverId: null,
      }));
    return combatSnapshotFromCharacterSheet(input.sheet, {
      actorId: input.placement.id,
      position: { x: input.placement.x, y: input.placement.y },
      targets,
      encounter: { profileId: placementProfileId(input.placement) },
    });
  } catch {
    return null;
  }
}

export function benchUnitStatusViews(input: {
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  session?: CombatBenchSession | null;
  deciderPlacementId: string | null;
  selectedPlacementId: string | null;
}): CombatBenchUnitStatusView[] {
  return input.placements.map((placement) => {
    const sheet = input.sheetById.get(placement.sheetId);
    const profileId = placementProfileId(placement);
    let health = benchHealthFromSheet(sheet, placement.label);
    const runtimeHealth = input.session?.healthByPlacementId[placement.id];
    if (health && runtimeHealth && runtimeHealth.current !== null) {
      health = {
        ...health,
        simpleCurrent: runtimeHealth.current,
        parts:
          health.mode === "normal" && runtimeHealth.parts
            ? health.parts.map((part) => {
                const live = runtimeHealth.parts?.[part.key];
                return live ? { ...part, current: live.current, max: live.max } : part;
              })
            : health.parts,
      };
    }
    const inventory = sheet ? readOpcodeInventory(sheet.status) : [];
    const weaponDraft = sheet ? selectPrimaryRangedWeapon(inventory) : null;
    const live = sheet
      ? snapshotForPlacement({
          sheet,
          placement,
          placements: input.placements,
          session: input.session,
        })
      : null;
    const hasLiveSnapshot = Boolean(input.session?.plansByPlacementId[placement.id]?.snapshot);
    const sense = senseFromSheet(sheet);

    let initiativeTotal: number | null = null;
    let initiativeRemaining: number | null = null;
    if (live) {
      initiativeTotal = live.initiativeTotal;
      initiativeRemaining = live.initiativeRemaining;
    } else if (sheet) {
      const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
      initiativeTotal = estimateInitiativePool({
        ref: summary.baseStats.ref,
      });
      initiativeRemaining = initiativeTotal;
    }

    return {
      placementId: placement.id,
      label: placement.label,
      team: placement.team,
      profileId,
      profileLabel: NPC_DIFFICULTY_LABELS[profileId],
      isDecider: placement.id === input.deciderPlacementId,
      isSelected: placement.id === input.selectedPlacementId,
      position: live
        ? { x: live.position.x, y: live.position.y }
        : { x: placement.x, y: placement.y },
      health,
      weaponName: weaponDraft?.name ?? null,
      weaponCaliber: weaponDraft?.weapon?.caliber?.trim() || null,
      weapon: live?.weapon ?? null,
      ammo: live?.ammo ?? null,
      mov: live?.mov ?? (sheet ? readOpcodeSheetSummary(sheet.stats, sheet.status).mov : null),
      initiativeRemaining,
      initiativeTotal,
      metersMovedThisRound: live?.metersMovedThisRound ?? null,
      suppressionActive: live?.suppressionActive ?? false,
      sustainedFireActive: live?.sustainedFire.active ?? false,
      hasLiveSnapshot,
      hearingA: sense.hearingA,
      openVisionV: sense.openVisionV,
      passiveS: sense.passiveS,
    };
  });
}
