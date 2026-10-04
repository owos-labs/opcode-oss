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

test("sheet section nav label covers attributes and skills", () => {
  const tables = buildMessageTables({
    en: { "sheet.attributes": "Attributes & Skills" },
    zh: { "sheet.attributes": "属性和技能" },
    ja: { "sheet.attributes": "能力と技能" },
  });
  assert.equal(messageForLocale(tables, "en", "sheet.attributes"), "Attributes & Skills");
  assert.equal(messageForLocale(tables, "zh", "sheet.attributes"), "属性和技能");
  assert.equal(messageForLocale(tables, "ja", "sheet.attributes"), "能力と技能");
});

test("zh locale resolves character sheet list empty states", () => {
  const tables = buildMessageTables({ en: {}, zh: {}, ja: {} });
  assert.equal(messageForLocale(tables, "zh", "characterSheets.list.noSearchResults"), "没有符合搜索条件的角色卡");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.list.emptyTitle"), "还没有角色卡");
});

test("character sheet hero links resolve per locale", () => {
  const tables = buildMessageTables({
    en: {},
    zh: {},
    ja: { "characterSheets.list.openRules": "オープンルール" },
  });
  assert.equal(messageForLocale(tables, "en", "characterSheets.list.github"), "GitHub");
  assert.equal(messageForLocale(tables, "en", "characterSheets.list.openRules"), "Open rules");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.list.openRules"), "开源规则");
  assert.equal(messageForLocale(tables, "ja", "characterSheets.list.openRules"), "オープンルール");
});

test("combat overview hero title resolves per locale", () => {
  const tables = buildMessageTables({
    en: {
      "combat.overview.heroLine1": "Combat",
      "combat.overview.heroLine2": "Tools",
    },
    zh: {
      "combat.overview.heroLine1": "战斗",
      "combat.overview.heroLine2": "工具",
    },
    ja: {
      "combat.overview.heroLine1": "戦闘",
      "combat.overview.heroLine2": "ツール",
    },
  });
  assert.equal(messageForLocale(tables, "en", "combat.overview.heroLine1"), "Combat");
  assert.equal(messageForLocale(tables, "en", "combat.overview.heroLine2"), "Tools");
  assert.equal(messageForLocale(tables, "zh", "combat.overview.heroLine1"), "战斗");
  assert.equal(messageForLocale(tables, "zh", "combat.overview.heroLine2"), "工具");
  assert.equal(messageForLocale(tables, "ja", "combat.overview.heroLine1"), "戦闘");
  assert.equal(messageForLocale(tables, "ja", "combat.overview.heroLine2"), "ツール");
});

test("character sheet hero title resolves per locale", () => {
  const tables = buildMessageTables({
    en: {},
    zh: {},
    ja: {
      "characterSheets.list.heroLine1": "キャラクター",
      "characterSheets.list.heroLine2": "デザイナー",
    },
  });
  assert.equal(messageForLocale(tables, "en", "characterSheets.list.heroLine1"), "Character");
  assert.equal(messageForLocale(tables, "en", "characterSheets.list.heroLine2"), "Designer");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.list.heroLine1"), "角色");
  assert.equal(messageForLocale(tables, "zh", "characterSheets.list.heroLine2"), "设计器");
  assert.equal(messageForLocale(tables, "ja", "characterSheets.list.heroLine1"), "キャラクター");
  assert.equal(messageForLocale(tables, "ja", "characterSheets.list.heroLine2"), "デザイナー");
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
