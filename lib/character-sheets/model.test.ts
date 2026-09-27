import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemContainer } from "./model.ts";
import {
  applyEditorState,
  careerCompliance,
  createLocalSheet,
  toMarkdown,
  dissolveContainer,
  duplicateInventoryItem,
  duplicateSheet,
  carriedKilograms,
  effectiveCarryKilograms,
  groupItems,
  moveContainerItem,
  placeContainerItem,
  parseImportedSheet,
  readContainers,
  normalizeLocalSheet,
  reorderContainerItem,
  sheetListLabel,
  writeContainers,
} from "./model.ts";
import { createOpcodeInventoryDraft } from "./opcodeInventory.ts";
import { createOpcodeSheetForm } from "./opcodeSheet.ts";

function bag(items: string[]): ItemContainer {
  return { name: "bag", weight: { base: 0, allows: 10 }, items };
}

test("moveContainerItem inserts before the target bag item", () => {
  const next = moveContainerItem(
    { a: bag(["x", "y"]), b: bag(["z"]) },
    "z",
    "a",
    "y",
  );
  assert.deepEqual(next.a.items, ["x", "z", "y"]);
  assert.deepEqual(next.b.items, []);
});

test("moveContainerItem with no destination unassigns the item", () => {
  const next = moveContainerItem({ a: bag(["x", "y"]) }, "x", null);
  assert.deepEqual(next.a.items, ["y"]);
});

test("effectiveCarryKilograms adds container allowance on top of the stat maximum", () => {
  assert.equal(effectiveCarryKilograms(20, { a: bag([]) }), 30);
  assert.equal(effectiveCarryKilograms(20, {}), 20);
});

test("carriedKilograms adds weapon weight times count and the container's own weight", () => {
  const knife = createOpcodeInventoryDraft("weapon");
  knife.weapon!.weight = "1.5";
  knife.count = "2";
  const note = createOpcodeInventoryDraft("generic");
  note.weight = "0.5";
  note.count = "2";
  assert.equal(carriedKilograms([knife, note], { a: bag([]) }), 4);
  assert.equal(
    carriedKilograms([knife], { a: { name: "pack", weight: { base: 1.5, allows: 5 }, items: [] } }),
    4.5,
  );
});

test("groupItems keeps the source bag and stores the configured carry weight", () => {
  const next = groupItems({ a: bag(["x"]) }, ["x", "y"], "pack", "c", 8);
  assert.deepEqual(next.a.items, []);
  assert.deepEqual(next.c, { name: "pack", weight: { base: 0, allows: 8 }, items: ["x", "y"] });
  assert.equal(groupItems({}, [], "pack", "d").d.weight.allows, 0);
});

test("placeContainerItem keeps a bag that just emptied", () => {
  const next = placeContainerItem({ a: bag(["x"]), b: bag(["y"]) }, "x", "b");
  assert.deepEqual(next.a.items, []);
  assert.deepEqual(next.b.items, ["y", "x"]);
  assert.deepEqual(placeContainerItem({ a: bag([]) }, "z", null), { a: bag([]) });
});

test("dissolveContainer removes the bag", () => {
  assert.deepEqual(dissolveContainer({ a: bag(["x"]) }, "a"), {});
  const bags = { a: bag(["x"]) };
  assert.equal(dissolveContainer(bags, "missing"), bags);
});

test("duplicateInventoryItem copies the draft beside the original", () => {
  const draft = createOpcodeInventoryDraft("generic");
  draft.name = "knife";
  const result = duplicateInventoryItem([draft], { a: bag([draft.id]) }, draft.id);
  assert.ok(result);
  assert.equal(result.drafts[1].name, "knife");
  assert.notEqual(result.drafts[1].id, draft.id);
  assert.notEqual(result.drafts[1].clientKey, draft.clientKey);
  assert.deepEqual(result.containers.a.items, [draft.id, result.drafts[1].id]);
  assert.equal(duplicateInventoryItem([draft], {}, "missing"), null);
});

test("reorderContainerItem swaps within a bag and no-ops at the edge", () => {
  const bags = { a: bag(["x", "y", "z"]) };
  assert.deepEqual(reorderContainerItem(bags, "y", -1).a.items, ["y", "x", "z"]);
  assert.equal(reorderContainerItem(bags, "x", -1), bags);
});

test("sheetListLabel prefers name, then handle, then id prefix", () => {
  const sheet = createLocalSheet("Ada");
  assert.equal(sheetListLabel(sheet), "Ada");
  sheet.name = "";
  sheet.info.base.handle = "Rook";
  assert.equal(sheetListLabel(sheet), "Rook");
  sheet.info.base.handle = "";
  assert.equal(sheetListLabel(sheet), sheet.id.slice(0, 8));
});

test("local sheets keep a normalized group for library organization", () => {
  const sheet = createLocalSheet("Ada");
  assert.equal(sheet.group, "");
  const normalized = normalizeLocalSheet({ ...sheet, group: "  crew  " });
  assert.equal(normalized?.group, "crew");
});

test("parseImportedSheet reads JSON and markdown description", () => {
  const json = parseImportedSheet(
    JSON.stringify({ id: "sheet-1", name: "Ada", info: { base: { desc: "Runner" } } }),
  );
  assert.equal(json?.id, "sheet-1");
  assert.equal(json?.info.base.desc, "Runner");

  const md = parseImportedSheet("# Ada\n\n## Description\nStreet kid\n\n## Stats\n");
  assert.equal(md?.name, "Ada");
  assert.equal(md?.info.base.desc, "Street kid");
});

test("duplicateSheet gets a new id and drops career mode", () => {
  const sheet = createLocalSheet("Ada");
  sheet.mode = "career";
  const copy = duplicateSheet(sheet);
  assert.notEqual(copy.id, sheet.id);
  assert.equal(copy.name, "Ada copy");
  assert.equal(copy.mode, "create");
});

test("readContainers / writeContainers roundtrip item ids", () => {
  const status = writeContainers({}, { pack: bag(["ammo"]) });
  assert.deepEqual(readContainers(status).pack.items, ["ammo"]);
});

test("applyEditorState writes character_id from the form", () => {
  const sheet = createLocalSheet("Ada");
  const form = createOpcodeSheetForm();
  form.name = "Ada";
  form.characterId = "00000000-0000-4000-8000-000000000001";
  const next = applyEditorState(sheet, form, []);
  assert.equal(next.character_id, "00000000-0000-4000-8000-000000000001");
});

test("toMarkdown includes metadata and inventory facts", () => {
  const sheet = createLocalSheet("Ada");
  const form = createOpcodeSheetForm();
  form.name = "Ada";
  form.version = "2";
  const knife = createOpcodeInventoryDraft("weapon");
  knife.name = "Knife";
  knife.count = "2";
  const snapshot = applyEditorState(sheet, form, [knife]);
  snapshot.version = "2";
  const md = toMarkdown(snapshot, form, [knife]);
  assert.match(md, /version: 2/);
  assert.match(md, /Knife/);
  assert.match(md, /## Weapons/);
  assert.match(md, /×2/);
});

test("careerCompliance flags an over-budget skill spend", () => {
  const form = createOpcodeSheetForm();
  form.skills = [{ id: "brawling", name: "Brawling", value: "99", specializations: [] }];
  const errors = careerCompliance(form, []);
  assert.equal(errors.skillPoints, "characterSheets.skills.budgetRemaining");
});
