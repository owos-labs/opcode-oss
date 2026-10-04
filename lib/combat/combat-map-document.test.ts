import assert from "node:assert/strict";
import test from "node:test";

import {
  clampAllMapElementsToArtboard,
  createDefaultCombatMapSvg,
  insertCombatMapRect,
  insertNpcToken,
  mapSizeLabel,
  nextElementName,
  parseCombatMapElements,
  removeCombatMapElement,
  canDeleteCombatMapElement,
  moveCombatMapElement,
  syncViewBoxToBoundingBox,
  updateCombatMapElement,
  updateCombatMapPathVertex,
} from "./combat-map-document.ts";

test("insertCombatMapRect defaults barrier and concealment cover metadata differently", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 0,
    y: 0,
    width: 40,
    height: 8,
  });
  const wall = parseCombatMapElements(svg).find((e) => e.id === "wall-0");
  assert.equal(wall?.attrs["cover-height"], "1");
  assert.equal(wall?.attrs.fill, "#c8c8c8");
  assert.equal(wall?.attrs.stroke, "#5c5c5c");
  svg = insertCombatMapRect(svg, {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 1,
    y: 1,
    width: 20,
    height: 10,
  });
  const cover = parseCombatMapElements(svg).find((e) => e.id === "cover-0");
  assert.equal(cover?.attrs["cover-height"], "0.75");
});

test("parseCombatMapElements reads barrier and npc_token kinds", () => {
  const svg = createDefaultCombatMapSvg();
  const withWall = insertCombatMapRect(svg, {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 100,
    height: 8,
  });
  const withNpc = insertNpcToken(withWall, {
    id: "npc-0",
    name: "npc-0",
    sheetId: "sheet-abc",
    cx: 50,
    cy: 60,
  });
  const elements = parseCombatMapElements(withNpc);
  assert.equal(elements.find((e) => e.id === "bounds")?.kind, "bounding_box");
  assert.equal(elements.find((e) => e.id === "wall-0")?.kind, "barrier");
  assert.equal(elements.find((e) => e.id === "npc-0")?.kind, "npc_token");
});

test("updateCombatMapElement patches attrs by name", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 0,
    y: 0,
    width: 40,
    height: 20,
  });
  const next = updateCombatMapElement(svg, "cover-0", { fill: "#ff0000", name: "cover-0" });
  const cover = parseCombatMapElements(next).find((e) => e.id === "cover-0");
  assert.equal(cover?.attrs.fill, "#ff0000");
});

test("removeCombatMapElement drops the tagged shape", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 1,
    y: 2,
    width: 30,
    height: 40,
  });
  const next = removeCombatMapElement(svg, "room-0");
  assert.equal(parseCombatMapElements(next).some((e) => e.id === "room-0"), false);
});

test("updateCombatMapElement ignores empty name patches", () => {
  const inserted = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "concealment",
    id: "cover-0",
    name: "cover-0",
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const id = parseCombatMapElements(inserted).find((e) => e.attrs.name === "cover-0")!.id;
  const next = updateCombatMapElement(inserted, id, { name: "" });
  assert.equal(parseCombatMapElements(next).find((e) => e.id === id)?.attrs.name, "cover-0");
});

test("nextElementName avoids collisions", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  assert.equal(nextElementName(svg, "wall"), "wall-1");
});

test("mapSizeLabel uses bounding_box dimensions in meters", () => {
  assert.equal(mapSizeLabel(createDefaultCombatMapSvg()), "20×20 m");
});

test("syncViewBoxToBoundingBox updates root svg extent", () => {
  const svg = updateCombatMapElement(createDefaultCombatMapSvg(), "bounds", {
    width: "1000",
    height: "600",
  });
  assert.match(svg, /viewBox="0 0 1000 600"/);
  assert.match(svg, /width="1000"/);
  assert.match(svg, /height="600"/);
});

test("syncViewBoxToBoundingBox follows bounds origin when moved", () => {
  const svg = moveCombatMapElement(createDefaultCombatMapSvg(), "bounds", 10, 5);
  assert.match(svg, /viewBox="10 5 1000 1000"/);
  const bounds = parseCombatMapElements(svg).find((e) => e.id === "bounds");
  assert.equal(bounds?.attrs.x, "10");
  assert.equal(bounds?.attrs.y, "5");
});

test("moveCombatMapElement moves all contents with bounding_box", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 50,
    height: 8,
  });
  svg = `${svg.replace(/<\/svg>/i, "")}<rect name="wall-rot" x="100" y="100" width="20" height="80" transform="rotate(90 100 100)" type="barrier" ar="15" ssp="100"/>\n</svg>`;
  svg = moveCombatMapElement(svg, "bounds", 10, 5);
  const wall = parseCombatMapElements(svg).find((e) => e.id === "wall-0");
  assert.equal(wall?.attrs.x, "20");
  assert.equal(wall?.attrs.y, "25");
  const rotated = parseCombatMapElements(svg).find((e) => e.id === "wall-rot");
  assert.equal(rotated?.attrs.x, "110");
  assert.equal(rotated?.attrs.y, "105");
  assert.equal(rotated?.attrs.transform, "rotate(90 110 105)");
});

test("moveCombatMapElement shifts rect and path shapes", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 50,
    height: 8,
  });
  svg = `${svg.replace(/<\/svg>/i, "")}<path name="wall-path" type="barrier" d="M0 0L10 0L10 10Z" ar="15" ssp="100"/>\n</svg>`;
  svg = moveCombatMapElement(svg, "wall-0", 5, -3);
  const wall = parseCombatMapElements(svg).find((e) => e.id === "wall-0");
  assert.equal(wall?.attrs.x, "15");
  assert.equal(wall?.attrs.y, "17");
  svg = moveCombatMapElement(svg, "wall-path", 2, 2);
  assert.match(parseCombatMapElements(svg).find((e) => e.id === "wall-path")?.attrs.d ?? "", /M2 2/);
});

test("moveCombatMapElement shifts npc_token circles", () => {
  let svg = createDefaultCombatMapSvg();
  svg = `${svg.replace(/<\/svg>/i, "")}<circle id="npc-0" name="npc-0" cx="20" cy="30" r="5" type="npc_token" sheet-id="sheet-a"/>\n</svg>`;
  svg = moveCombatMapElement(svg, "npc-0", 4, -2);
  const npc = parseCombatMapElements(svg).find((e) => e.id === "npc-0");
  assert.equal(npc?.attrs.cx, "24");
  assert.equal(npc?.attrs.cy, "28");
});

test("canDeleteCombatMapElement blocks map bounds", () => {
  const bounds = parseCombatMapElements(createDefaultCombatMapSvg()).find((e) => e.kind === "bounding_box");
  assert.ok(bounds);
  assert.equal(canDeleteCombatMapElement(bounds!), false);
  const wall = { id: "wall-0", kind: "barrier" as const, tag: "rect" as const, attrs: {} };
  assert.equal(canDeleteCombatMapElement(wall), true);
});

test("removeCombatMapElement drops deletable shapes only", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  svg = removeCombatMapElement(svg, "wall-0");
  assert.equal(parseCombatMapElements(svg).some((e) => e.id === "wall-0"), false);
  const before = parseCombatMapElements(svg).length;
  svg = removeCombatMapElement(svg, "bounds");
  assert.equal(parseCombatMapElements(svg).length, before);
});

test("updateCombatMapPathVertex moves one path point", () => {
  const svg = `<svg viewBox="0 0 100 100"><path name="p-0" type="barrier" d="M0 0L20 0L20 20Z"/></svg>`;
  const next = updateCombatMapPathVertex(svg, "p-0", 1, 30, 0);
  assert.match(parseCombatMapElements(next).find((e) => e.id === "p-0")?.attrs.d ?? "", /L30 0/);
});

test("insertCombatMapRect keeps out-of-bounds geometry", () => {
  const svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-2",
    name: "room-2",
    x: -439,
    y: 3520,
    width: 111,
    height: 110,
  });
  const room = parseCombatMapElements(svg).find((e) => e.id === "room-2");
  assert.equal(room?.attrs.x, "-439");
  assert.equal(room?.attrs.y, "3520");
  assert.equal(room?.attrs.width, "111");
  assert.equal(room?.attrs.height, "110");
});

test("moveCombatMapElement allows dragging outside artboard", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 780,
    y: 10,
    width: 90,
    height: 40,
  });
  svg = moveCombatMapElement(svg, "room-0", 50, 0);
  const room = parseCombatMapElements(svg).find((e) => e.id === "room-0");
  assert.equal(room?.attrs.x, "830");
});

test("updateCombatMapElement works for bounding_box without name", () => {
  const svg = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" type="bounding_box"/></svg>`;
  const bounds = parseCombatMapElements(svg)[0]!;
  const next = updateCombatMapElement(svg, bounds.id, { width: "80" });
  const updated = parseCombatMapElements(next)[0];
  assert.equal(updated?.attrs.width, "80");
});

test("clampAllMapElementsToArtboard preserves rotated rect local geometry", () => {
  const svg = `${createDefaultCombatMapSvg().replace(
    /<\/svg>/i,
    `<rect id="wall-rot" name="wall-rot" x="100" y="100" width="20" height="80" transform="rotate(90 100 100)" type="barrier" ar="15" ssp="100"/>\n</svg>`,
  )}`;
  const before = parseCombatMapElements(svg).find((e) => e.id === "wall-rot")!;
  const after = parseCombatMapElements(clampAllMapElementsToArtboard(svg)).find((e) => e.id === "wall-rot")!;
  assert.equal(after.attrs.width, before.attrs.width);
  assert.equal(after.attrs.height, before.attrs.height);
  assert.equal(after.attrs.transform, before.attrs.transform);
});

test("clampAllMapElementsToArtboard preserves slightly rotated rect geometry", () => {
  const svg = createDefaultCombatMapSvg().replace(
    /<\/svg>/i,
    `<rect id="c" name="c" x="10" y="10" width="20" height="30" transform="rotate(6 20 25)" type="concealment"/>\n</svg>`,
  );
  const before = parseCombatMapElements(svg).find((e) => e.id === "c")!;
  const after = parseCombatMapElements(clampAllMapElementsToArtboard(svg)).find((e) => e.id === "c")!;
  assert.equal(after.attrs.width, before.attrs.width);
  assert.equal(after.attrs.height, before.attrs.height);
});

test("clampAllMapElementsToArtboard fixes legacy out-of-bounds elements", () => {
  let svg = createDefaultCombatMapSvg();
  svg = svg.replace(
    /<\/svg>/i,
    `<rect name="room-2" x="-439" y="3520.5" width="111" height="110" type="room" fill="#FFCC24"/>\n</svg>`,
  );
  const next = clampAllMapElementsToArtboard(svg);
  const room = parseCombatMapElements(next).find((e) => e.id === "room-2");
  assert.equal(room?.attrs.x, "0");
  assert.ok(Number(room?.attrs.y) <= 890);
});
