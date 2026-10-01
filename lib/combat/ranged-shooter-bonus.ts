import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import type { OpcodeWeaponSkillDraft } from "../character-sheets/opcodeInventory.types.ts";
import {
  calculateOpcodeSpecializationRollBonus,
  readOpcodeLinkedStatValue,
  readOpcodeSheetSummary,
} from "../character-sheets/opcodeSheet.ts";
import {
  findOpcodeSpecializationPreset,
  OPCODE_SKILL_DEFINITIONS,
  OPCODE_SPECIALIZATION_PRESETS,
} from "../character-sheets/opcodeSkillDefinitions.ts";

function parseSkillMul(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

function parseSpecMul(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 2;
}

function normalizeSpecToken(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function presetForSkillSpec(skillName: string, specToken: string) {
  const normalized = normalizeSpecToken(specToken);
  return (
    findOpcodeSpecializationPreset(skillName, specToken) ??
    OPCODE_SPECIALIZATION_PRESETS[skillName]?.find(
      (preset) =>
        normalizeSpecToken(preset.key) === normalized ||
        normalizeSpecToken(preset.name) === normalized,
    )
  );
}

/** Weapon spec wire name ↔ sheet spec / preset name. */
export function weaponSpecializationMatches(
  skillName: string,
  weaponSpecName: string,
  sheetSpecName: string,
): boolean {
  const weapon = normalizeSpecToken(weaponSpecName);
  const sheet = normalizeSpecToken(sheetSpecName);
  if (!weapon || !sheet) return false;
  if (weapon === sheet) return true;

  const presetFromWeapon = presetForSkillSpec(skillName, weaponSpecName);
  const presetFromSheet = presetForSkillSpec(skillName, sheetSpecName);
  if (presetFromWeapon && presetFromSheet && presetFromWeapon.key === presetFromSheet.key) {
    return true;
  }
  if (presetFromWeapon && normalizeSpecToken(presetFromWeapon.name) === sheet) return true;
  if (presetFromSheet && normalizeSpecToken(presetFromSheet.name) === weapon) return true;
  return false;
}

export type RangedShooterAttackParts = {
  linkedStat: number;
  skillLevel: number;
  specializationBonus: number;
  specLabel?: string;
};

export function rangedShooterAttackParts(
  sheet: CharacterSheet | undefined,
  weaponSkills: readonly OpcodeWeaponSkillDraft[],
): RangedShooterAttackParts {
  if (!sheet) {
    return { linkedStat: 0, skillLevel: 0, specializationBonus: 0 };
  }

  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const weaponSkill =
    weaponSkills.find((s) => s.name === "marksmanship") ?? weaponSkills[0];
  if (!weaponSkill?.name.trim()) {
    const mark = summary.skills.find((s) => s.name === "marksmanship")?.value ?? 0;
    return {
      linkedStat: summary.baseStats.ref,
      skillLevel: mark,
      specializationBonus: 0,
    };
  }

  const sheetSkill = summary.skills.find((s) => s.name === weaponSkill.name);
  const skillMul = parseSkillMul(weaponSkill.mul);
  const statKeys =
    sheetSkill?.stats?.length
      ? sheetSkill.stats
      : OPCODE_SKILL_DEFINITIONS[weaponSkill.name] ?? ["ref"];
  const linkedStat = readOpcodeLinkedStatValue(statKeys, summary.baseStats);
  const skillLevel = (sheetSkill?.value ?? 0) * skillMul;

  let specializationBonus = 0;
  let specLabel: string | undefined;
  for (const wSpec of weaponSkill.specializations) {
    const sheetSpec = sheetSkill?.specializations.find((s) =>
      weaponSpecializationMatches(weaponSkill.name, wSpec.name, s.name),
    );
    if (!sheetSpec) continue;
    const specMul = parseSpecMul(wSpec.mul);
    specializationBonus +=
      calculateOpcodeSpecializationRollBonus(sheetSpec.value) * (specMul / 2);
    specLabel = sheetSpec.name;
  }

  return { linkedStat, skillLevel, specializationBonus, specLabel };
}

export function rangedShooterAttackBonus(
  parts: RangedShooterAttackParts,
  attackMalus: number,
): number {
  return (
    parts.linkedStat +
    parts.skillLevel +
    parts.specializationBonus +
    attackMalus
  );
}
