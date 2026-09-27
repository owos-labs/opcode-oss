export const ITEM_PRESET_CATEGORIES = ["items", "melee", "ranged", "attachments", "ammo", "magazines", "throwable", "armor"] as const;
export type ItemPresetCategory = (typeof ITEM_PRESET_CATEGORIES)[number];

export type ItemPresetCategoryCounts = Record<ItemPresetCategory, number>;

import type { OpcodeInventoryItemWire } from "./opcodeInventory.types";

/** Same shape as one `status.inventory[]` entry in character_sheet_dto. */
export type ItemPresetData = OpcodeInventoryItemWire & {
  id: string;
  name: string;
};

export type ItemPreset = {
  id: string;
  category: ItemPresetCategory;
  createdBy: string;
  createdAt: string;
  data: ItemPresetData;
};

export const ITEM_PRESET_DRAG_TYPE = "application/x-opcode-item-preset";

export function ammoGroupsStartOpen(query: string) {
  return query.trim().length > 0;
}

function presetCaliber(item: ItemPreset): string {
  const block = item.category === "ammo" ? item.data.ammo : item.data.weapon;
  if (!block || typeof block !== "object") return "";
  const caliber = (block as { caliber?: unknown }).caliber;
  return typeof caliber === "string" ? caliber.trim() : "";
}

export function groupItemPresets(category: string, items: ItemPreset[]): { label: string; items: ItemPreset[] }[] {
  if (category !== "ammo" && category !== "ranged") return [{ label: "", items }];
  const groups = new Map<string, ItemPreset[]>();
  for (const item of items) {
    const caliber = presetCaliber(item);
    const list = groups.get(caliber);
    if (list) list.push(item);
    else groups.set(caliber, [item]);
  }
  return [...groups].map(([label, groupItems]) => ({ label, items: groupItems }));
}
