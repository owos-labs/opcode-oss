import assert from "node:assert/strict";
import { test } from "node:test";

import {
  characterSheetId,
  characterSheetSection,
  characterSidebar,
  combatMapId,
  sidebarMotionKey,
  sidebarShowsCharacterList,
} from "./motion.ts";

test("sidebarMotionKey keeps the character-sheet sidebar mounted", () => {
  assert.equal(sidebarMotionKey("/character-sheet"), "/character-sheet");
  assert.equal(sidebarMotionKey("/character-sheet/abc/basics"), "/character-sheet");
  assert.equal(sidebarMotionKey("/character-sheet/abc/inventory"), "/character-sheet");
});

test("sidebarMotionKey remounts other apps", () => {
  assert.equal(sidebarMotionKey("/combat"), "/combat");
  assert.equal(sidebarMotionKey("/combat/test"), "/combat");
});

test("characterSheetId reads the selected sheet from the path", () => {
  assert.equal(characterSheetId("/character-sheet"), undefined);
  assert.equal(characterSheetId("/character-sheet/abc/basics"), "abc");
});

test("character sidebar stays on the sheet sections", () => {
  assert.equal(characterSidebar("/character-sheet"), "list");
  assert.equal(characterSidebar("/character-sheet/abc/inventory"), "section");
  assert.equal(characterSidebar("/character-sheet/abc/attributes"), "section");
  assert.equal(characterSheetSection("/character-sheet/abc/presets"), "presets");
  assert.equal(characterSheetSection("/character-sheet/abc/unknown"), "basics");
});

test("character editor replaces the list filters with inner nav", () => {
  assert.equal(sidebarShowsCharacterList("/character-sheet"), true);
  assert.equal(sidebarShowsCharacterList("/character-sheet/abc/basics"), false);
  assert.equal(sidebarShowsCharacterList("/character-sheet/abc/inventory"), false);
});

test("combatMapId reads the selected map from the path", () => {
  assert.equal(combatMapId("/combat"), undefined);
  assert.equal(combatMapId("/combat/test"), undefined);
  assert.equal(combatMapId("/combat/a3b3855a-ea16-477c-89db-86e28fc9576c"), "a3b3855a-ea16-477c-89db-86e28fc9576c");
});
