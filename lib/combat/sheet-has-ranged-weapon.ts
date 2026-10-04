import { readOpcodeInventory } from "../character-sheets/opcodeInventory.ts";
import type { OpcodeLocalSheet } from "../character-sheets/model.ts";
import { selectPrimaryRangedWeapon } from "./character-sheet-snapshot.ts";

export function sheetHasRangedWeapon(sheet: OpcodeLocalSheet): boolean {
  return selectPrimaryRangedWeapon(readOpcodeInventory(sheet.status)) !== null;
}
