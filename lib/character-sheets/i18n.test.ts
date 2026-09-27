import assert from "node:assert/strict";
import { test } from "node:test";

import enSheets from "./messages.json";
import zhSheets from "./messages.zh.json";
import { buildMessageTables, flattenMessages, messageForLocale } from "./i18n-messages.ts";

const zhChrome = {
  en: {},
  zh: {
    "characterSheets.stats.ref": "反射",
    "characterSheets.stats.int": "智力",
  },
  ja: {},
} as const;
const tables = buildMessageTables(zhChrome);

const ATTRIBUTES_PREFIXES = [
  "characterSheets.skillNames.",
  "characterSheets.skillDescriptions.",
  "characterSheets.specializationPresets.",
  "characterSheets.skillGroups.",
  "characterSheets.skills.",
  "characterSheets.health.",
  "characterSheets.points.",
  "characterSheets.saves.",
  "characterSheets.stats.",
  "characterSheets.statDescriptions.",
  "characterSheets.units.",
  "characterSheets.sections.attributes",
  "characterSheets.sections.attributesHint",
  "characterSheets.sections.preview",
  "characterSheets.sections.previewHint",
] as const;

function attributeMessageKeys(flat: Record<string, string>) {
  return Object.keys(flat).filter((key) =>
    ATTRIBUTES_PREFIXES.some((prefix) =>
      prefix.endsWith(".") ? key.startsWith(prefix) : key === prefix,
    ),
  );
}

test("zh locale mirrors en keys for attributes glossaries", () => {
  const enFlat = flattenMessages(enSheets);
  const zhFlat = flattenMessages(zhSheets);
  const enKeys = attributeMessageKeys(enFlat).sort();
  const zhKeys = attributeMessageKeys(zhFlat).sort();
  assert.deepEqual(zhKeys, enKeys);
});

test("zh locale resolves attributes skill copy from Opcode CN glossary", () => {
  assert.equal(messageForLocale(tables, "zh", "characterSheets.skills.title"), "技能");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.skillNames.marksmanship"), "射击");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.skillGroups.combat.title"), "战斗");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.health.mode"), "生命值规则");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.saves.stun"), "晕眩豁免");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.stats.mov"), "移动速度");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.stats.ref"), "反射");
  assert.match(messageForLocale(tables, "zh", "characterSheets.statDescriptions.wil"), /感知豁免/);
  assert.match(
    messageForLocale(tables, "zh", "characterSheets.skillDescriptions.calm"),
    /巴比妥类/,
  );
});

test("en locale still resolves attributes keys", () => {
  assert.equal(messageForLocale(tables, "en", "characterSheets.skills.title"), "Skills");
});

test("zh locale resolves inventory save label", () => {
  const localized = buildMessageTables({
    en: {},
    zh: { "characterSheets.inventory.save": "保存物品" },
    ja: {},
  });
  assert.equal(messageForLocale(localized, "zh", "characterSheets.inventory.save"), "保存物品");
  assert.equal(messageForLocale(localized, "en", "characterSheets.inventory.save"), "Save inventory");
});
