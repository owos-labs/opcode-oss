import assert from "node:assert/strict";
import test from "node:test";

import { createOpcodeSheetForm } from "./opcodeSheet";
import { createOpcodeInventoryDraft } from "./opcodeInventory";
import {
  formatComplianceErrorLine,
  listCareerComplianceErrors,
} from "./compliance-errors";

const t = (key: string, params?: Record<string, string | number>) => {
  const table: Record<string, string> = {
    "sheet.inventory": "Inventory",
    "characterSheets.inventory.unnamed": "Unnamed",
    "characterSheets.inventory.kinds.weapon": "Weapon",
    "characterSheets.inventory.fields.name": "Name",
    "characterSheets.inventory.fields.caliber": "Caliber",
    "characterSheets.inventory.validation.required": "Required.",
    "characterSheets.inventory.validation.caliber": "Enter a caliber.",
    "mode.complianceLine": "{place}: {message}",
    "mode.complianceItem": "#{index} {name}{kind}",
  };
  let out = table[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  }
  return out;
};

test("listCareerComplianceErrors keeps distinct inventory paths", () => {
  const form = createOpcodeSheetForm();
  const weapon = createOpcodeInventoryDraft("weapon");
  weapon.name = "";
  const ranged = createOpcodeInventoryDraft("weapon");
  ranged.name = "Rifle";
  ranged.weapon!.type = "ranged";
  ranged.weapon!.caliber = "";
  const lines = listCareerComplianceErrors(form, [weapon, ranged]);
  const ids = lines.map((line) => line.id);
  assert.ok(ids.includes("inventory.0.name"));
  assert.ok(ids.includes("inventory.1.weapon.caliber"));
});

test("formatComplianceErrorLine includes item and field context", () => {
  const line = {
    id: "inventory.0.name",
    messageKey: "characterSheets.inventory.validation.required",
    sectionKey: "sheet.inventory",
    itemIndex: 0,
    itemKind: "weapon" as const,
    fieldKey: "characterSheets.inventory.fields.name",
  };
  assert.equal(
    formatComplianceErrorLine(line, t),
    "Inventory · #1 Unnamed (Weapon) · Name: Required.",
  );
});
