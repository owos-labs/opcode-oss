import { NextResponse } from "next/server";

import {
  getItemPreset,
  isItemPresetCategory,
  itemPresetCatalogMetadata,
  itemPresetCategories,
} from "@/lib/character-sheets/item-presets";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim() || undefined;
  if (category && !isItemPresetCategory(category)) {
    return NextResponse.json(
      { error: "invalid_category", message: `Unknown item preset category: ${category}`, categories: itemPresetCategories() },
      { status: 400 },
    );
  }

  const { id } = await params;
  const item = getItemPreset(id, category);
  if (!item) {
    return NextResponse.json({ error: "not_found", message: `Unknown item preset: ${id}` }, { status: 404 });
  }

  return NextResponse.json({ ...itemPresetCatalogMetadata(), item });
}
