import presets from "./item-presets.json";
import { normalizeItemPresetDto } from "./item-preset-dto.ts";
import {
  ITEM_PRESET_CATEGORIES,
  type ItemPreset,
  type ItemPresetCategory,
  type ItemPresetCategoryCounts,
  type ItemPresetData,
} from "./item-presets.types";

export { ITEM_PRESET_CATEGORIES } from "./item-presets.types";
export type { ItemPreset, ItemPresetCategory, ItemPresetCategoryCounts, ItemPresetData } from "./item-presets.types";

type RawRecord = { created_by?: unknown; created_at?: unknown; data?: unknown };

const catalog = presets as {
  version?: unknown;
  updated_at?: unknown;
  items?: { items?: Record<string, RawRecord> };
  [key: string]: unknown;
};

export function itemPresetCategories() {
  return [...ITEM_PRESET_CATEGORIES];
}

export function isItemPresetCategory(value: string | null | undefined): value is ItemPresetCategory {
  return Boolean(value && ITEM_PRESET_CATEGORIES.includes(value as ItemPresetCategory));
}

export function itemPresetCatalogMetadata() {
  return {
    version: typeof catalog.version === "number" ? catalog.version : 1,
    updated_at: typeof catalog.updated_at === "string" ? catalog.updated_at : null,
  };
}

export function listItemPresets(category?: string, keyword?: string): ItemPreset[] {
  const categories = category === undefined
    ? ITEM_PRESET_CATEGORIES
    : isItemPresetCategory(category)
      ? [category]
      : [];
  const needle = keyword?.trim().toLocaleLowerCase() || "";
  return categories.flatMap((name) => {
    const source = name === "items" ? catalog.items?.items : catalog[name];
    const records = (source || {}) as Record<string, RawRecord>;
    return Object.entries(records).flatMap(([id, record]) => {
      const data = record.data;
      if (!data || typeof data !== "object") return [];
      const item = normalizeItemPresetDto(data as Record<string, unknown>) as ItemPresetData;
      if (needle && !`${id} ${JSON.stringify(item)}`.toLocaleLowerCase().includes(needle)) return [];
      return [{
        id,
        category: name,
        createdBy: typeof record.created_by === "string" ? record.created_by : "",
        createdAt: typeof record.created_at === "string" ? record.created_at : "",
        data: item,
      }];
    });
  });
}

export function countItemPresets(keyword?: string): ItemPresetCategoryCounts {
  const counts = Object.fromEntries(ITEM_PRESET_CATEGORIES.map((category) => [category, 0])) as ItemPresetCategoryCounts;
  for (const item of listItemPresets(undefined, keyword)) counts[item.category] += 1;
  return counts;
}

export function getItemPreset(id: string, category?: string): ItemPreset | null {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  return listItemPresets(category).find((item) => item.id === normalizedId) || null;
}
