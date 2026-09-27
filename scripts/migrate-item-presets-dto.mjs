import fs from "node:fs";

import { normalizeItemPresetDto } from "../lib/character-sheets/item-preset-dto.ts";
import { ITEM_PRESET_CATEGORIES } from "../lib/character-sheets/item-presets.types.ts";

const path = "lib/character-sheets/item-presets.json";
const catalog = JSON.parse(fs.readFileSync(path, "utf8"));

let count = 0;
for (const category of ITEM_PRESET_CATEGORIES) {
  const bucket = category === "items" ? catalog.items?.items : catalog[category];
  if (!bucket || typeof bucket !== "object") continue;
  for (const record of Object.values(bucket)) {
    if (!record || typeof record !== "object" || !record.data || typeof record.data !== "object") continue;
    record.data = normalizeItemPresetDto(record.data);
    count += 1;
  }
}

fs.writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
console.log("normalized preset data entries:", count);
