import assert from "node:assert/strict";
import test from "node:test";

import { createOpcodeInventoryDraft } from "./opcodeInventory";
import { inventoryExportMarkdown } from "./inventory-export-md";

test("inventoryExportMarkdown lists weapon attachments and armor protection", () => {
  const rifle = createOpcodeInventoryDraft("weapon");
  rifle.name = "Rifle";
  rifle.weapon!.type = "ranged";
  rifle.weapon!.caliber = "5.56x45";
  rifle.weapon!.modifications.push({
    id: crypto.randomUUID(),
    slot: "muzzle",
    name: "Suppressor",
    description: "Quiet",
    effects: [],
    source: {},
  });
  const plate = createOpcodeInventoryDraft("armor");
  plate.name = "Plate";
  plate.armor!.material = "ceramic";
  plate.armor!.protection.torso = "12";

  const md = inventoryExportMarkdown([rifle, plate], {
    pack: { name: "Pack", items: [rifle.id] },
  });

  assert.match(md, /## Weapons/);
  assert.match(md, /Suppressor/);
  assert.match(md, /location: Pack/);
  assert.match(md, /## Armor/);
  assert.match(md, /torso 12/);
});

test("applyEditorState keeps inventory wire on export snapshot", async () => {
  const { applyEditorState, createLocalSheet } = await import("./model.ts");
  const { createOpcodeSheetForm } = await import("./opcodeSheet.ts");
  const sheet = createLocalSheet("Ada");
  const form = createOpcodeSheetForm();
  form.name = "Ada";
  const mag = createOpcodeInventoryDraft("magazine");
  mag.name = "PMAG";
  mag.magazine!.caliber = "5.56x45";
  mag.magazine!.containsMax = "30";
  const next = applyEditorState(sheet, form, [mag]);
  const inventory = (next.status as { inventory?: unknown[] }).inventory;
  assert.ok(Array.isArray(inventory));
  assert.equal((inventory?.[0] as { magazine?: unknown })?.magazine ? 1 : 0, 1);
});
