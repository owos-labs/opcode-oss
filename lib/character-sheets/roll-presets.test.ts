import assert from "node:assert/strict";
import { test } from "node:test";

import type { CharacterSheet } from "./characterSheet.types.ts";
import {
  buildAttackRollPresetFormula,
  buildAttackRollPresetLabel,
  createCustomAttackRollPreset,
  formatCompactRollPreset,
  resolveAttackPresetFormulas,
  summarizeRollPresetTerms,
  listAttackSkillOptions,
  listAttackSpecSuggestionNames,
  listSavePresetColumn,
  readAttackRollPresets,
  writeAttackRollPresets,
} from "./roll-presets.ts";
import { buildCreateCharacterSheetDto, createOpcodeSheetForm, readOpcodeSheetSummary } from "./opcodeSheet.ts";
import { createOpcodeInventoryDraft } from "./opcodeInventory.ts";

const labels = {
  stat: (key: string) => ({ ref: "反射", wil: "毅力", bod: "体质", luk: "幸运" }[key] ?? key),
  skill: (name: string) => ({ marksmanship: "射击", perception: "专注 / 洞察", calm: "沉着", consitution: "强韧" }[name] ?? name),
  specialization: (_skill: string, spec: string) => spec,
  save: (column: string) => column,
  bonus: "加值",
  adjustment: "调整",
  accuracy: "精度",
  fortitude: "强韧",
};

test("summarizeRollPresetTerms totals modifier values directly", () => {
  assert.equal(
    summarizeRollPresetTerms([
      { value: 5, label: "步枪" },
      { value: 6, label: "射击" },
      { value: 2, label: "加值" },
    ]),
    "1d10+13",
  );
  assert.equal(
    summarizeRollPresetTerms([
      { value: 8, label: "AEK-971 (KORD 6P67)" },
      { value: 7, label: "射击" },
      { value: 6, label: "加值" },
    ]),
    "1d10+21",
  );
  assert.equal(summarizeRollPresetTerms([{ value: 5, label: "射击" }, { value: -2, label: "调整" }]), "1d10+3");
});

test("formatCompactRollPreset matches attack shorthand", () => {
  assert.equal(
    formatCompactRollPreset([
      { value: 5, label: "步枪" },
      { value: 6, label: "射击" },
      { value: 2, label: "加值" },
    ]),
    "1d10+5步枪+6射击+2加值",
  );
});

test("listSavePresetColumn spec entry counts 1 spec point as 2 dice", () => {
  const summary = {
    baseStats: { ref: 5, int: 5, wil: 5, chr: 5, bod: 5, luk: 5 },
    fortitudeBonus: 0,
    skills: [{
      name: "perception",
      value: 4,
      stats: ["wil"],
      specializations: [{ name: "observation", value: 2, rollBonus: 4 }],
    }],
  } as import("./opcodeSheet.ts").OpcodeSheetSummary;

  const specEntry = listSavePresetColumn("perception", summary, labels)
    .find((entry) => entry.id.includes(":spec:"));
  assert.ok(specEntry);
  assert.equal(specEntry.formula, "1d10+5毅力+4专注 / 洞察+4加值");
  assert.equal(specEntry.totalFormula, "1d10+13");
});

test("listSavePresetColumn builds stun and luck presets", () => {
  const summary = {
    baseStats: { ref: 5, int: 5, wil: 5, chr: 5, bod: 6, luk: 7 },
    fortitudeBonus: 3,
    skills: [],
  } as import("./opcodeSheet.ts").OpcodeSheetSummary;

  assert.equal(
    listSavePresetColumn("stun", summary, labels)[0]?.formula,
    "1d10+5毅力+3强韧",
  );
  assert.equal(
    listSavePresetColumn("luck", summary, labels)[0]?.formula,
    "1d10+7幸运",
  );
});

test("buildAttackRollPresetFormula uses weapon skills from inventory draft", () => {
  const form = createOpcodeSheetForm();
  form.name = "Test";
  form.baseStats.ref = "6";
  const marksmanship = form.skills.find((skill) => skill.name === "marksmanship");
  assert.ok(marksmanship);
  marksmanship.value = "6";
  marksmanship.specializations = [{ id: "spec-rifle", name: "assaultRifles", value: "2" }];
  const dto = buildCreateCharacterSheetDto(form);
  const sheet: CharacterSheet = {
    id: "sheet-1",
    name: "Test",
    created_at: "",
    updated_at: "",
    created_by: "local",
    character_id: null,
    rule_book: "Opcode",
    version: "1",
    stats: dto.stats,
    status: dto.status,
  };
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.name = "步枪";
  weapon.weapon!.skills = [{
    name: "marksmanship",
    mul: "1",
    specializations: [{ name: "assaultRifles", mul: "2" }],
  }];

  const formula = buildAttackRollPresetFormula(sheet, weapon, labels);
  assert.equal(formula, "1d10+6反射+6射击+4加值");
});

test("buildAttackRollPresetLabel uses skill name only", () => {
  assert.equal(buildAttackRollPresetLabel("marksmanship", labels), "射击");
  assert.equal(buildAttackRollPresetLabel("perception", labels), "专注 / 洞察");
});

test("createCustomAttackRollPreset auto-generates label when omitted", () => {
  const form = createOpcodeSheetForm();
  form.name = "Test";
  form.baseStats.ref = "6";
  const marksmanship = form.skills.find((skill) => skill.name === "marksmanship");
  assert.ok(marksmanship);
  marksmanship.value = "6";
  marksmanship.specializations = [{ id: "spec-rifle", name: "assaultRifles", value: "2" }];
  const dto = buildCreateCharacterSheetDto(form);
  const sheet: CharacterSheet = {
    id: "sheet-1",
    name: "Test",
    created_at: "",
    updated_at: "",
    created_by: "local",
    character_id: null,
    rule_book: "Opcode",
    version: "1",
    stats: dto.stats,
    status: dto.status,
  };
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.name = "步枪";
  weapon.weapon!.skills = [{
    name: "marksmanship",
    mul: "1",
    specializations: [{ name: "assaultRifles", mul: "2" }],
  }];

  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const preset = createCustomAttackRollPreset(summary, weapon, {
    itemId: weapon.id,
    skillName: "marksmanship",
    specializationName: "assaultRifles",
    adjustment: 2,
  }, labels);

  assert.ok(preset);
  assert.equal(preset.label, "射击");
  assert.equal(preset.formula, "1d10+6反射+6射击+4加值+2调整");
  assert.equal(preset.skillName, "marksmanship");
  assert.equal(preset.specializationName, "assaultRifles");
  assert.equal(preset.adjustment, 2);
  const resolved = resolveAttackPresetFormulas(summary, weapon, preset, labels);
  assert.equal(resolved.totalFormula, "1d10+18");
});

test("listAttackSkillOptions includes every Opcode skill", () => {
  const summary = {
    baseStats: { ref: 5, int: 5, wil: 5, chr: 5, bod: 5, luk: 5 },
    fortitudeBonus: 0,
    skills: [{ name: "customSkill", value: 2, stats: ["ref"], specializations: [] }],
  } as import("./opcodeSheet.ts").OpcodeSheetSummary;
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.weapon!.skills = [{ name: "marksmanship", mul: "1", specializations: [] }];

  const options = listAttackSkillOptions(summary, weapon);
  assert.ok(options.includes("marksmanship"));
  assert.ok(options.includes("martial"));
  assert.ok(options.includes("customSkill"));
});

test("listAttackSpecSuggestionNames lists only sheet specializations for the skill", () => {
  const form = createOpcodeSheetForm();
  form.name = "Test";
  const marksmanship = form.skills.find((skill) => skill.name === "marksmanship");
  assert.ok(marksmanship);
  marksmanship.specializations = [
    { id: "spec-rifle", name: "assaultRifles", value: "2" },
    { id: "spec-custom", name: "自定义专精", value: "0" },
  ];
  const summary = readOpcodeSheetSummary(buildCreateCharacterSheetDto(form).stats, {});

  const suggestions = listAttackSpecSuggestionNames(summary, "marksmanship");
  assert.deepEqual(suggestions, ["assaultRifles", "自定义专精"]);
});

test("ranged attack preset formula reads accuracy from weapon", () => {
  const form = createOpcodeSheetForm();
  form.name = "Test";
  form.baseStats.ref = "6";
  const marksmanship = form.skills.find((skill) => skill.name === "marksmanship");
  assert.ok(marksmanship);
  marksmanship.value = "6";
  const dto = buildCreateCharacterSheetDto(form);
  const summary = readOpcodeSheetSummary(dto.stats, {});
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.name = "步枪";
  weapon.weapon!.type = "ranged";
  weapon.weapon!.caliber = "5.56";
  weapon.weapon!.accuracy = "+2";
  weapon.weapon!.skills = [{ name: "marksmanship", mul: "1", specializations: [] }];

  const preset = createCustomAttackRollPreset(summary, weapon, {
    itemId: weapon.id,
    skillName: "marksmanship",
    specializationName: "",
    adjustment: 0,
  }, labels);

  assert.ok(preset);
  assert.equal(preset.formula, "1d10+6反射+6射击+2精度");

  weapon.weapon!.accuracy = "+4";
  const resolved = resolveAttackPresetFormulas(summary, weapon, preset, labels);
  assert.equal(resolved.formula, "1d10+6反射+6射击+4精度");
});

test("createCustomAttackRollPreset keeps id when updating", () => {
  const form = createOpcodeSheetForm();
  form.name = "Test";
  form.baseStats.ref = "6";
  const marksmanship = form.skills.find((skill) => skill.name === "marksmanship");
  assert.ok(marksmanship);
  marksmanship.value = "6";
  const summary = readOpcodeSheetSummary(buildCreateCharacterSheetDto(form).stats, {});
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.name = "步枪";
  weapon.weapon!.skills = [{ name: "marksmanship", mul: "1", specializations: [] }];

  const updated = createCustomAttackRollPreset(summary, weapon, {
    id: "preset-1",
    itemId: weapon.id,
    skillName: "marksmanship",
    specializationName: "",
    adjustment: 0,
    label: "自定义名称",
  }, labels);

  assert.ok(updated);
  assert.equal(updated.id, "preset-1");
  assert.equal(updated.label, "自定义名称");
});

test("readAttackRollPresets round-trips through stats.rules.extensions", () => {
  const stats = writeAttackRollPresets({}, [{
    id: "a1",
    itemId: "w1",
    label: "步枪",
    formula: "1d10+5步枪+6射击+2加值",
    skillName: "marksmanship",
    specializationName: "",
    adjustment: 0,
  }]);
  assert.deepEqual(readAttackRollPresets(stats), [{
    id: "a1",
    itemId: "w1",
    label: "步枪",
    formula: "1d10+5步枪+6射击+2加值",
    skillName: "marksmanship",
    specializationName: "",
    adjustment: 0,
  }]);
});
