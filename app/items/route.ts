import { NextResponse } from "next/server";

import {
  isItemPresetCategory,
  itemPresetCatalogMetadata,
  itemPresetCategories,
  countItemPresets,
  listItemPresets,
} from "@/lib/character-sheets/item-presets";

export function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim() || undefined;
  const kwd = url.searchParams.get("kwd")?.trim() || undefined;
  const categories = itemPresetCategories();

  if (category && !isItemPresetCategory(category)) {
    return NextResponse.json(
      { error: "invalid_category", message: `Unknown item preset category: ${category}`, categories },
      { status: 400 },
    );
  }

  const items = listItemPresets(category, kwd);
  return NextResponse.json({
    ...itemPresetCatalogMetadata(),
    categories,
    category: category || null,
    kwd: kwd || null,
    counts: countItemPresets(kwd),
    total: items.length,
    items,
  });
}
