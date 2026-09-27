import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import {
  readMagazineRounds,
  readNextMagazineRound,
  readOpcodeInventory,
  readOpcodeWeaponFireModes,
} from "../character-sheets/opcodeInventory.ts";
import type { OpcodeInventoryDraft } from "../character-sheets/opcodeInventory.types.ts";
import type {
  CombatEncounterConfig,
  CombatSnapshot,
  CombatTargetView,
} from "./snapshot.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import { damageDiceExprFromAmmoDraft } from "./opcode-ammo-damage.ts";

/** ponytail: FSM rolls initiative; until then use REF+WIL+marksmanship as pool points. */
export function estimateInitiativePool(input: {
  ref: number;
  wil: number;
  marksmanship: number;
}): number {
  return 3 * (input.ref + input.wil + input.marksmanship);
}

/** Leading dice count from strings like `3d6`, `3d6+1`, `2d6-1`. */
export function expectedDamageDiceFromDiceExpr(expr: string): number {
  const m = expr.trim().match(/^(\d+)\s*d/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type CombatSnapshotFromSheetOptions = {
  position: Vec2;
  targets: readonly CombatTargetView[];
  actorId?: string;
  coverId?: string | null;
  encounter?: Partial<CombatEncounterConfig>;
  weaponItemId?: string;
  initiativeRemaining?: number;
  metersMovedThisRound?: number;
};

export function selectPrimaryRangedWeapon(
  drafts: readonly OpcodeInventoryDraft[],
  weaponItemId?: string,
): OpcodeInventoryDraft | null {
  if (weaponItemId) {
    const picked = drafts.find((d) => d.id === weaponItemId && d.kind === "weapon");
    if (picked?.weapon?.type === "ranged") return picked;
    return null;
  }
  return (
    drafts.find((d) => d.kind === "weapon" && d.weapon?.type === "ranged") ?? null
  );
}

function skillLevel(summary: ReturnType<typeof readOpcodeSheetSummary>, name: string): number {
  return summary.skills.find((s) => s.name === name)?.value ?? 0;
}

function ammoStatsFromDraft(
  ammoDraft: OpcodeInventoryDraft | undefined,
): Pick<CombatSnapshot["ammo"], "penetration" | "expectedDamageDice"> {
  const pen = Number(ammoDraft?.ammo?.penetration);
  const diceRaw = damageDiceExprFromAmmoDraft(ammoDraft?.ammo);
  return {
    penetration: Number.isFinite(pen) ? pen : 0,
    expectedDamageDice: expectedDamageDiceFromDiceExpr(diceRaw),
  };
}

export function combatAmmoFromLoadedWeapon(
  weapon: OpcodeInventoryDraft,
  drafts: readonly OpcodeInventoryDraft[],
): Pick<CombatSnapshot["ammo"], "penetration" | "expectedDamageDice" | "roundsInMagazine"> {
  const magazineId = weapon.weapon?.magazineId?.trim();
  if (magazineId) {
    const rounds = readMagazineRounds([...drafts], magazineId);
    const roundsInMagazine = rounds.length;
    const next = readNextMagazineRound([...drafts], magazineId);
    if (next?.ammoId) {
      const ammoDraft = drafts.find((d) => d.id === next.ammoId);
      return { ...ammoStatsFromDraft(ammoDraft), roundsInMagazine };
    }
    return { penetration: 0, expectedDamageDice: 0, roundsInMagazine };
  }

  return { penetration: 0, expectedDamageDice: 0, roundsInMagazine: 0 };
}

export function combatSnapshotFromCharacterSheet(
  sheet: CharacterSheet,
  options: CombatSnapshotFromSheetOptions,
): CombatSnapshot {
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const inventory = readOpcodeInventory(sheet.status);
  const weapon = selectPrimaryRangedWeapon(inventory, options.weaponItemId);
  if (!weapon?.weapon) {
    throw new Error("character sheet has no ranged weapon for combat snapshot");
  }

  const modes = readOpcodeWeaponFireModes(weapon.weapon.mode);
  const semiAutoOrBetter = modes.includes("semi") || modes.includes("auto") || modes.includes("burst");
  const initiativeTotal =
    options.initiativeRemaining ??
    estimateInitiativePool({
      ref: summary.baseStats.ref,
      wil: summary.baseStats.wil,
      marksmanship: skillLevel(summary, "marksmanship"),
    });

  const encounter: CombatEncounterConfig = {
    profileId: "trained",
    allowNpcSurrender: false,
    surrenderThreshold: -Infinity,
    ...options.encounter,
  };

  const ammo = combatAmmoFromLoadedWeapon(weapon, inventory);

  return {
    snapshotVersion: 1,
    barrierVersion: 1,
    actorId: options.actorId ?? sheet.id,
    position: options.position,
    mov: summary.mov,
    initiativeTotal,
    initiativeRemaining: initiativeTotal,
    metersMovedThisRound: options.metersMovedThisRound ?? 0,
    coverId: options.coverId ?? null,
    weapon: {
      rangeM: Number(weapon.weapon.range) || 0,
      rateOfFire: Number(weapon.weapon.rof) || 0,
      accuracy: Number(weapon.weapon.accuracy) || 0,
      semiAutoOrBetter,
    },
    ammo,
    sustainedFire: { active: false, walkFireMalus: 0, token: 0 },
    suppressionActive: false,
    targets: [...options.targets],
    encounter,
  };
}
