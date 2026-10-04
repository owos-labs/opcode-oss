import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultCombatMapSvg, insertCombatMapRect } from "./combat-map-document.ts";
import {
  combatMapElementIdAfterUpdate,
  combatMapElementIdFromDom,
  combatMapNpcTokenIdFromDom,
  combatMapShapeSignatureFromElement,
  ensureCombatMapElementIds,
} from "./combat-map-element-id.ts";
import { insertNpcToken } from "./combat-map-document.ts";
import { parseCombatMapElements } from "./combat-map-document.ts";

test("combatMapElementIdAfterUpdate keeps canonical id when display name changes", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const id = parseCombatMapElements(svg).find((entry) => entry.attrs.name === "cover-0")!.id;
  const { id: nextId } = combatMapElementIdAfterUpdate(svg, id, { name: "crate-a" });
  assert.equal(nextId, id);
  const updated = combatMapElementIdAfterUpdate(svg, id, { name: "crate-a" }).svg;
  assert.equal(parseCombatMapElements(updated).find((entry) => entry.id === id)?.attrs.name, "crate-a");
});

test("ensureCombatMapElementIds assigns uuid id and display name", () => {
  const svg = `<svg viewBox="0 0 100 100"><rect fill="#D9D9D9" type="concealment" name="" x="10" y="10" width="20" height="30" transform="rotate(6 20 25)"/></svg>`;
  const next = ensureCombatMapElementIds(svg);
  const el = parseCombatMapElements(next)[0]!;
  assert.match(el.attrs.id ?? "", /^[0-9a-f-]{36}$/i);
  assert.match(el.attrs.name ?? "", /^cover-\d+$/);
});

test("insertCombatMapRect assigns uuid id by default", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  const el = parseCombatMapElements(svg).find((entry) => entry.kind === "barrier")!;
  assert.match(el.id, /^[0-9a-f-]{36}$/i);
  assert.match(el.attrs.name ?? "", /^wall-\d+$/);
});

test("combatMapElementIdFromDom resolves unnamed shapes by geometry signature", () => {
  const svg = `<svg viewBox="0 0 100 100"><rect fill="#D9D9D9" type="concealment" name="" x="10" y="10" width="20" height="30"/></svg>`;
  const el = parseCombatMapElements(svg)[0]!;
  const node = {
    tagName: "rect",
    getAttribute(name: string) {
      return el.attrs[name] ?? null;
    },
    getAttributeNames() {
      return Object.keys(el.attrs);
    },
  } as unknown as Element;
  assert.equal(combatMapElementIdFromDom(node, svg), el.id);
});

test("combatMapNpcTokenIdFromDom resolves npc_token circles only", () => {
  const svg = insertNpcToken(createDefaultCombatMapSvg(), {
    id: "npc-0",
    name: "npc-0",
    cx: 10,
    cy: 10,
    sheetId: "sheet-1",
  });
  const el = parseCombatMapElements(svg).find((entry) => entry.kind === "npc_token")!;
  const node = {
    tagName: "circle",
    closest() {
      return this;
    },
    getAttribute(name: string) {
      return el.attrs[name] ?? null;
    },
    getAttributeNames() {
      return Object.keys(el.attrs);
    },
  } as unknown as Element;
  assert.equal(combatMapNpcTokenIdFromDom(node, svg), el.id);
  const wall = parseCombatMapElements(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "barrier",
      id: "wall-0",
      name: "wall-0",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    }),
  ).find((entry) => entry.kind === "barrier")!;
  const wallNode = {
    tagName: "rect",
    closest() {
      return this;
    },
    getAttribute(name: string) {
      return wall.attrs[name] ?? null;
    },
    getAttributeNames() {
      return Object.keys(wall.attrs);
    },
  } as unknown as Element;
  assert.equal(combatMapNpcTokenIdFromDom(wallNode, svg), null);
});

test("combatMapShapeSignatureFromElement matches geometry not display name", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  });
  const el = parseCombatMapElements(svg).find((entry) => entry.attrs.name === "wall-0")!;
  assert.equal(combatMapShapeSignatureFromElement(el), ["rect", "barrier", "1", "2", "3", "4", ""].join("\0"));
});
