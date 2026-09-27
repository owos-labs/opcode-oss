import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localizePresetUserFacingFields,
  normalizeLocaleText,
  resolveLocaleText,
  resolvePresetUserFacingFields,
} from "./locale-text.ts";
import type { Locale } from "./i18n-messages";

test("normalizeLocaleText maps plain strings to zh or en buckets", () => {
  assert.deepEqual(normalizeLocaleText("短管步枪"), { zh: "短管步枪" });
  assert.deepEqual(normalizeLocaleText("Optic placeholder"), { en: "Optic placeholder" });
});

test("resolveLocaleText prefers active locale then falls back", () => {
  assert.equal(resolveLocaleText({ zh: "中文", en: "English" }, "zh"), "中文");
  assert.equal(resolveLocaleText({ zh: "中文", en: "English" }, "ja"), "English");
  assert.equal(resolveLocaleText("legacy", "en"), "legacy");
});

test("localizePresetUserFacingFields skips name but localizes description and effect", () => {
  const preset = {
    name: "Optic",
    desc: "English desc",
    attachment: { slot: "optic", effect: "Zoom bonus" },
    weapon: {
      modifications: {
        sight: {
          "70000000-0000-4000-8000-000000000001": {
            name: "Default loadout",
            description: "14.5 inch barrel",
            effects: {
              "1": {
                mod: {
                  target: "diff",
                  value: {
                    applied_on: { text: "low light" },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  localizePresetUserFacingFields(preset);
  assert.equal(preset.name, "Optic");
  assert.deepEqual(preset.desc, { en: "English desc" });
  assert.deepEqual(preset.attachment.effect, { en: "Zoom bonus" });
  const mod = preset.weapon.modifications.sight["70000000-0000-4000-8000-000000000001"];
  assert.deepEqual(mod.description, { en: "14.5 inch barrel" });
  assert.deepEqual(mod.effects["1"].mod.value.applied_on.text, { en: "low light" });

  resolvePresetUserFacingFields(preset, "en" as Locale);
  assert.equal(preset.name, "Optic");
  assert.equal(preset.desc, "English desc");
  assert.equal(preset.attachment.effect, "Zoom bonus");
  assert.equal(mod.description, "14.5 inch barrel");
  assert.equal(mod.effects["1"].mod.value.applied_on.text, "low light");
});
