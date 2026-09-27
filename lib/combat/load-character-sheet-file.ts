import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";

/** Node / CLI only — do not import from client components. */
export function loadCharacterSheetFromFile(filePath: string): CharacterSheet {
  const abs = isAbsolute(filePath) ? filePath : resolve(filePath);
  return JSON.parse(readFileSync(abs, "utf8")) as CharacterSheet;
}
