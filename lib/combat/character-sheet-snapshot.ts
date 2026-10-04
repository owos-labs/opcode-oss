import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { OPCODE_HEALTH_PARTS } from "../character-sheets/characterSheet.types.ts";
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
import { senseRanges, type LocalizationStore } from "./localization.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import { damageDiceExprFromAmmoDraft } from "./opcode-ammo-damage.ts";
import { parseOpcodeDamageExpr } from "./damage-roll.ts";
import { rangedShooterAttackBonus, rangedShooterAttackParts } from "./ranged-shooter-bonus.ts";

/** Expected Nd10 + REF + bonus until the bench has a real roll. Extra d10 at REF 8/10/15. */
export function estimateInitiativePool(input: {
  ref: number;
  initiativeBonus?: number;
}): number {
  const bonus = input.initiativeBonus ?? 0;
  const effective = input.ref + bonus;
  let extra = 0;
  if (effective >= 8) extra++;
  if (effective >= 10) extra++;
  if (effective >= 15) extra++;
  return Math.round(5.5 * (1 + extra)) + input.ref + bonus;
}

/** Leading dice count from strings like `3d6`, `3d6+1`, `2d6-1`. */
export function expectedDamageDiceFromDiceExpr(expr: string): number {
  return parseOpcodeDamageExpr(expr).groups.reduce((sum, group) => sum + group.count, 0);
}

export type CombatSnapshotFromSheetOptions = {
  position: Vec2;
  targets: readonly CombatTargetView[];
  actorId?: string;
  coverId?: string | null;
  encounter?: Partial<CombatEncounterConfig>;
  weaponItemId?: string;
  initiativeRemaining?: number;
  initiativeTotal?: number;
  metersMovedThisRound?: number;
  intel?: LocalizationStore;
  factionId?: string;
};

/** Worn armor on the sheet: per-part AR from inventory armor items (strongest per part). */
export function armorByPartFromCharacterSheet(
  sheet: CharacterSheet | undefined,
): Record<string, number> {
  const merged = Object.fromEntries(
    OPCODE_HEALTH_PARTS.map((part) => [part, 0]),
  ) as Record<string, number>;
  if (!sheet) return merged;
  for (const item of readOpcodeInventory(sheet.status)) {
    if (item.kind !== "armor" || !item.armor) continue;
    for (const part of OPCODE_HEALTH_PARTS) {
      const ar = Math.max(0, Number(item.armor.protection[part]?.trim() || "0") || 0);
      if (ar > merged[part]!) merged[part] = ar;
    }
  }
  return merged;
}

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

function ammoStatsFromDraft(
  ammoDraft: OpcodeInventoryDraft | undefined,
): Pick<CombatSnapshot["ammo"], "penetration" | "expectedDamageDice" | "damageDiceExpr" | "explosive"> {
  const pen = Number(ammoDraft?.ammo?.penetration);
  const diceRaw = damageDiceExprFromAmmoDraft(ammoDraft?.ammo);
  return {
    penetration: Number.isFinite(pen) ? pen : 0,
    expectedDamageDice: expectedDamageDiceFromDiceExpr(diceRaw),
    ...(diceRaw ? { damageDiceExpr: diceRaw } : {}),
    explosive: ammoDraft?.ammo?.damage === "explosive",
  };
}

export function combatAmmoFromLoadedWeapon(
  weapon: OpcodeInventoryDraft,
  drafts: readonly OpcodeInventoryDraft[],
): Pick<CombatSnapshot["ammo"], "penetration" | "expectedDamageDice" | "damageDiceExpr" | "roundsInMagazine"> {
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
  const defaultFireMode = modes[0];
  const initiativeTotal =
    options.initiativeTotal ??
    options.initiativeRemaining ??
    estimateInitiativePool({
      ref: summary.baseStats.ref,
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
    visionRangeM: senseRanges(summary.baseStats.ref, summary.baseStats.wil).openVisionV,
    attackBonus: rangedShooterAttackBonus(rangedShooterAttackParts(sheet, weapon.weapon.skills ?? []), 0),
    healthMode: summary.healthMode ?? "simple",
    reflexSaveBonus: summary.baseStats.ref + (summary.skills.find(s => s.name === "athletics")?.value ?? 0),
    hitPoints: summary.currentHealth ?? summary.maxHealth,
    initiativeTotal,
    initiativeRemaining: initiativeTotal,
    metersMovedThisRound: options.metersMovedThisRound ?? 0,
    coverId: options.coverId ?? null,
    weapon: {
      id: weapon.id,
      rangeM: Number(weapon.weapon.range) || 0,
      rateOfFire: Number(weapon.weapon.rof) || 0,
      accuracy: Number(weapon.weapon.accuracy) || 0,
      semiAutoOrBetter,
      availableFireModes: modes,
      burstPoolOk: modes.includes("burst"),
      ...(defaultFireMode ? { defaultFireMode } : {}),
      canPenCover: ammo.penetration > 0,
    },
    ammo,
    sustainedFire: { active: false, walkFireMalus: 0, token: 0 },
    suppressionActive: false,
    targets: [...options.targets],
    encounter,
    lukLeft: summary.baseStats.luk,
    armorByPart: armorByPartFromCharacterSheet(sheet),
    ...(options.intel ? { intel: options.intel } : {}),
    ...(options.factionId ? { factionId: options.factionId } : {}),
  };
}
