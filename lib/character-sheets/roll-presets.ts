import { rangedShooterAttackParts, weaponSpecializationMatches } from "../combat/ranged-shooter-bonus.ts";
import type { CharacterSheet, OpcodeStatKey } from "./characterSheet.types";
import type { OpcodeInventoryDraft } from "./opcodeInventory.types";
import {
  calculateOpcodeSpecializationRollBonus,
  readOpcodeLinkedStatValue,
  readOpcodeSheetSummary,
  type OpcodeSheetSummary,
} from "./opcodeSheet.ts";
import { OPCODE_SKILL_DEFINITIONS, OPCODE_SKILL_GROUPS } from "./opcodeSkillDefinitions.ts";

export const SAVE_PRESET_COLUMNS = [
  "stun",
  "death",
  "perception",
  "luck",
  "calm",
  "fortitude",
] as const;

export type SavePresetColumn = (typeof SAVE_PRESET_COLUMNS)[number];

export type RollPresetTerm = {
  value: number;
  label: string;
};

export type RollPresetEntry = {
  id: string;
  label: string;
  formula: string;
  totalFormula: string;
};

export type RollPresetLabels = {
  stat: (key: OpcodeStatKey) => string;
  skill: (name: string) => string;
  specialization: (skillName: string, specName: string) => string;
  save: (column: SavePresetColumn) => string;
  bonus: string;
  adjustment: string;
  accuracy: string;
  fortitude: string;
};

export type AttackRollPreset = {
  id: string;
  itemId: string;
  label: string;
  formula: string;
  skillName: string;
  specializationName: string;
  adjustment: number;
};

export type AttackRollPresetInput = {
  id?: string;
  itemId: string;
  skillName: string;
  specializationName: string;
  adjustment: number;
  label?: string;
};

export type CustomAttackRollParts = {
  linkedStat: number;
  skillLevel: number;
  specializationBonus: number;
};

export function formatCompactRollPreset(terms: RollPresetTerm[]): string {
  let text = "1d10";
  for (const term of terms) {
    const value = Math.round(term.value);
    if (!value || !term.label.trim()) continue;
    text += value > 0 ? `+${value}${term.label.trim()}` : `${value}${term.label.trim()}`;
  }
  return text;
}

export function summarizeRollPresetTerms(terms: RollPresetTerm[]): string {
  const total = terms.reduce((sum, term) => sum + Math.round(term.value), 0);
  if (!total) return "1d10";
  return total > 0 ? `1d10+${total}` : `1d10${total}`;
}

function buildRollPresetEntry(
  id: string,
  label: string,
  terms: RollPresetTerm[],
): RollPresetEntry {
  const formula = formatCompactRollPreset(terms);
  return {
    id,
    label,
    formula,
    totalFormula: summarizeRollPresetTerms(terms),
  };
}

export function listWeaponDrafts(drafts: OpcodeInventoryDraft[]): OpcodeInventoryDraft[] {
  return drafts.filter((draft) => draft.kind === "weapon");
}

export function listAttackSkillOptions(
  summary: OpcodeSheetSummary,
  weapon?: OpcodeInventoryDraft,
): string[] {
  const fromWeapon = (weapon?.weapon?.skills ?? [])
    .map((skill) => skill.name.trim())
    .filter(Boolean);
  const fromSheet = summary.skills.map((skill) => skill.name.trim()).filter(Boolean);
  const fromOpcode = Object.keys(OPCODE_SKILL_DEFINITIONS);
  return [...new Set([...fromWeapon, ...fromOpcode, ...fromSheet])];
}

export function defaultAttackSkillName(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft,
): string {
  return listAttackSkillOptions(summary, weapon)[0] ?? "marksmanship";
}

export function listAttackSpecOptions(
  summary: OpcodeSheetSummary,
  skillName: string,
): Array<{ name: string; value: number; rollBonus: number }> {
  return summary.skills
    .find((skill) => skill.name === skillName)
    ?.specializations
    .filter((spec) => spec.value > 0) ?? [];
}

export function listAttackSpecSuggestionNames(
  summary: OpcodeSheetSummary,
  skillName: string,
): string[] {
  return summary.skills
    .find((skill) => skill.name === skillName)
    ?.specializations
    .map((spec) => spec.name.trim())
    .filter(Boolean) ?? [];
}

export function parseWeaponAccuracy(weapon: OpcodeInventoryDraft): number {
  if (weapon.kind !== "weapon") return 0;
  const raw = weapon.weapon?.accuracy ?? "0";
  const value = Number(String(raw).replace(/^\+/, ""));
  return Number.isFinite(value) ? value : 0;
}

export function isRangedWeaponDraft(weapon: OpcodeInventoryDraft): boolean {
  return weapon.kind === "weapon" && weapon.weapon?.type === "ranged";
}

export function buildAttackRollPresetLabel(skillName: string, labels: RollPresetLabels): string {
  return labels.skill(skillName);
}

function attackLinkedStatLabel(
  summary: OpcodeSheetSummary,
  skillName: string,
  labels: RollPresetLabels,
): string {
  const sheetSkill = summary.skills.find((skill) => skill.name === skillName);
  const statKeys = sheetSkill?.stats?.length
    ? sheetSkill.stats
    : OPCODE_SKILL_DEFINITIONS[skillName] ?? ["ref"];
  return labels.stat(statKeys[0] ?? "ref");
}

export function computeCustomAttackRollParts(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft,
  skillName: string,
  specializationName: string,
): CustomAttackRollParts {
  const sheetSkill = summary.skills.find((skill) => skill.name === skillName);
  const weaponSkill = weapon.weapon?.skills?.find((skill) => skill.name === skillName);
  const skillMul = weaponSkill ? parseSkillMul(weaponSkill.mul) : 1;
  const statKeys = sheetSkill?.stats?.length
    ? sheetSkill.stats
    : OPCODE_SKILL_DEFINITIONS[skillName] ?? ["ref"];
  const linkedStat = readOpcodeLinkedStatValue(statKeys, summary.baseStats);
  const skillLevel = (sheetSkill?.value ?? 0) * skillMul;

  let specializationBonus = 0;
  if (specializationName.trim()) {
    const sheetSpec = sheetSkill?.specializations.find((spec) =>
      spec.name === specializationName
      || weaponSpecializationMatches(skillName, specializationName, spec.name),
    );
    const weaponSpec = weaponSkill?.specializations.find((spec) =>
      weaponSpecializationMatches(skillName, spec.name, specializationName),
    );
    const specMul = weaponSpec ? parseSpecMul(weaponSpec.mul) : 2;
    if (sheetSpec) {
      specializationBonus = calculateOpcodeSpecializationRollBonus(sheetSpec.value) * (specMul / 2);
    }
  }

  return { linkedStat, skillLevel, specializationBonus };
}

export function buildCustomAttackRollPresetTerms(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft,
  input: Pick<AttackRollPresetInput, "skillName" | "specializationName" | "adjustment">,
  labels: RollPresetLabels,
): RollPresetTerm[] | null {
  if (weapon.kind !== "weapon") return null;
  const parts = computeCustomAttackRollParts(
    summary,
    weapon,
    input.skillName,
    input.specializationName,
  );
  const terms: RollPresetTerm[] = [
    { value: parts.linkedStat, label: attackLinkedStatLabel(summary, input.skillName, labels) },
    { value: parts.skillLevel, label: labels.skill(input.skillName) },
  ];
  if (parts.specializationBonus > 0) {
    terms.push({ value: parts.specializationBonus, label: labels.bonus });
  }
  if (isRangedWeaponDraft(weapon)) {
    const accuracy = parseWeaponAccuracy(weapon);
    if (accuracy) {
      terms.push({ value: accuracy, label: labels.accuracy });
    }
  } else if (input.adjustment) {
    terms.push({ value: input.adjustment, label: labels.adjustment });
  }
  return terms;
}

export function buildCustomAttackRollPresetFormula(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft,
  input: Pick<AttackRollPresetInput, "skillName" | "specializationName" | "adjustment">,
  labels: RollPresetLabels,
): string | null {
  const terms = buildCustomAttackRollPresetTerms(summary, weapon, input, labels);
  return terms ? formatCompactRollPreset(terms) : null;
}

export function createCustomAttackRollPreset(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft,
  input: AttackRollPresetInput,
  labels: RollPresetLabels,
): AttackRollPreset | null {
  const terms = buildCustomAttackRollPresetTerms(summary, weapon, input, labels);
  if (!terms) return null;
  const formula = formatCompactRollPreset(terms);
  const label = input.label?.trim() || buildAttackRollPresetLabel(input.skillName, labels);
  return {
    id: input.id ?? crypto.randomUUID(),
    itemId: input.itemId,
    label,
    formula,
    skillName: input.skillName,
    specializationName: input.specializationName,
    adjustment: input.adjustment,
  };
}

export function resolveAttackPresetFormulas(
  summary: OpcodeSheetSummary,
  weapon: OpcodeInventoryDraft | undefined,
  preset: AttackRollPreset,
  labels: RollPresetLabels,
): { formula: string; totalFormula: string } {
  if (!weapon || !preset.skillName) {
    return { formula: preset.formula, totalFormula: preset.formula };
  }
  const terms = buildCustomAttackRollPresetTerms(summary, weapon, {
    skillName: preset.skillName,
    specializationName: preset.specializationName,
    adjustment: preset.adjustment,
  }, labels);
  if (!terms) {
    return { formula: preset.formula, totalFormula: preset.formula };
  }
  return {
    formula: formatCompactRollPreset(terms),
    totalFormula: summarizeRollPresetTerms(terms),
  };
}

export function listSavePresetColumn(
  column: SavePresetColumn,
  summary: OpcodeSheetSummary,
  labels: RollPresetLabels,
): RollPresetEntry[] {
  switch (column) {
    case "stun":
      return [buildRollPresetEntry("stun:base", labels.save("stun"), [
        { value: summary.baseStats.wil, label: labels.stat("wil") },
        { value: summary.fortitudeBonus, label: labels.fortitude },
      ])];
    case "death":
      return [buildRollPresetEntry("death:base", labels.save("death"), [
        { value: summary.baseStats.bod, label: labels.stat("bod") },
        { value: summary.fortitudeBonus, label: labels.fortitude },
      ])];
    case "luck":
      return [buildRollPresetEntry("luck:base", labels.save("luck"), [
        { value: summary.baseStats.luk, label: labels.stat("luk") },
      ])];
    case "perception":
      return listSkillSavePresets("perception", summary, labels, "perception");
    case "calm":
      return listSkillSavePresets("calm", summary, labels, "calm");
    case "fortitude":
      return listSkillSavePresets("consitution", summary, labels, "fortitude");
  }
}

function listSkillSavePresets(
  skillName: string,
  summary: OpcodeSheetSummary,
  labels: RollPresetLabels,
  column: SavePresetColumn,
): RollPresetEntry[] {
  const skill = summary.skills.find((entry) => entry.name === skillName);
  const statKeys = skill?.stats?.length
    ? skill.stats
    : OPCODE_SKILL_DEFINITIONS[skillName] ?? ["wil"];
  const linkedStat = readOpcodeLinkedStatValue(statKeys, summary.baseStats);

  if (!skill || skill.value <= 0) {
    return [buildRollPresetEntry(`${column}:stat`, labels.save(column), [
      { value: linkedStat, label: labels.stat(statKeys[0] ?? "wil") },
    ])];
  }

  const entries: RollPresetEntry[] = [buildRollPresetEntry(`${column}:skill`, labels.skill(skillName), [
    { value: linkedStat, label: labels.stat(statKeys[0] ?? "wil") },
    { value: skill.value, label: labels.skill(skillName) },
  ])];

  for (const spec of skill.specializations) {
    if (spec.value <= 0) continue;
    entries.push(buildRollPresetEntry(`${column}:spec:${spec.name}`, labels.specialization(skillName, spec.name), [
      { value: linkedStat, label: labels.stat(statKeys[0] ?? "wil") },
      { value: skill.value, label: labels.skill(skillName) },
      { value: spec.rollBonus, label: labels.bonus },
    ]));
  }

  return entries;
}

export function buildAttackRollPresetFormula(
  sheet: CharacterSheet,
  weapon: OpcodeInventoryDraft,
  labels: RollPresetLabels,
): string | null {
  const terms = buildAttackRollPresetTerms(sheet, weapon, labels);
  return terms ? formatCompactRollPreset(terms) : null;
}

function buildAttackRollPresetTerms(
  sheet: CharacterSheet,
  weapon: OpcodeInventoryDraft,
  labels: RollPresetLabels,
): RollPresetTerm[] | null {
  if (weapon.kind !== "weapon" || !weapon.weapon) return null;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const parts = rangedShooterAttackParts(sheet, weapon.weapon.skills ?? []);
  const skillName = weapon.weapon.skills.find((entry) => entry.name.trim())?.name ?? "marksmanship";
  const terms: RollPresetTerm[] = [
    { value: parts.linkedStat, label: attackLinkedStatLabel(summary, skillName, labels) },
    { value: parts.skillLevel, label: labels.skill(skillName) },
  ];
  if (isRangedWeaponDraft(weapon)) {
    const accuracy = parseWeaponAccuracy(weapon);
    if (accuracy) {
      terms.push({ value: accuracy, label: labels.accuracy });
    }
  }
  if (parts.specializationBonus > 0) {
    terms.push({ value: parts.specializationBonus, label: labels.bonus });
  }
  return terms;
}

export function listWeaponAttackCandidates(
  sheet: CharacterSheet,
  drafts: OpcodeInventoryDraft[],
  labels: RollPresetLabels,
): Array<{ weapon: OpcodeInventoryDraft; formula: string }> {
  return drafts.flatMap((draft) => {
    if (draft.kind !== "weapon") return [];
    const formula = buildAttackRollPresetFormula(sheet, draft, labels);
    return formula ? [{ weapon: draft, formula }] : [];
  });
}

export function readAttackRollPresets(stats: Record<string, unknown>): AttackRollPreset[] {
  const rules = asRecord(stats.rules);
  const extensions = asRecord(rules.extensions);
  const raw = extensions.attackPresets;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const row = asRecord(entry);
    if (typeof row.id !== "string" || typeof row.itemId !== "string") return [];
    if (typeof row.formula !== "string" || typeof row.label !== "string") return [];
    return [{
      id: row.id,
      itemId: row.itemId,
      label: row.label,
      formula: row.formula,
      skillName: typeof row.skillName === "string" ? row.skillName : "",
      specializationName: typeof row.specializationName === "string" ? row.specializationName : "",
      adjustment: Number(row.adjustment) || 0,
    }];
  });
}

export function writeAttackRollPresets(
  stats: Record<string, unknown>,
  presets: AttackRollPreset[],
): Record<string, unknown> {
  const next = structuredClone(stats);
  const rules = asRecord(next.rules);
  const extensions = asRecord(rules.extensions);
  extensions.attackPresets = presets;
  rules.extensions = extensions;
  next.rules = rules;
  return next;
}

export function createAttackRollPreset(
  sheet: CharacterSheet,
  weapon: OpcodeInventoryDraft,
  labels: RollPresetLabels,
): AttackRollPreset | null {
  const terms = buildAttackRollPresetTerms(sheet, weapon, labels);
  if (!terms) return null;
  const skillName = weapon.weapon!.skills.find((entry) => entry.name.trim())?.name ?? "marksmanship";
  return {
    id: crypto.randomUUID(),
    itemId: weapon.id,
    label: buildAttackRollPresetLabel(skillName, labels),
    formula: formatCompactRollPreset(terms),
    skillName,
    specializationName: "",
    adjustment: 0,
  };
}

function parseSkillMul(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
}

function parseSpecMul(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 2;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
