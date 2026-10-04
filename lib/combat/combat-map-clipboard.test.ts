import assert from "node:assert/strict";
import test from "node:test";

import {
  combatMapElementToTag,
  copyCombatMapElementFromSvg,
  parseCombatMapElementTag,
  pasteCombatMapElement,
} from "./combat-map-clipboard.ts";
import { createDefaultCombatMapSvg, insertCombatMapRect, parseCombatMapElements } from "./combat-map-document.ts";

test("copyCombatMapElementFromSvg serializes selected shapes", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "barrier",
    id: "wall-0",
    name: "wall-0",
    x: 10,
    y: 20,
    width: 40,
    height: 8,
  });
  const copied = copyCombatMapElementFromSvg(svg, "wall-0");
  assert.match(copied ?? "", /name="wall-0"/);
  assert.match(copied ?? "", /type="barrier"/);
  assert.equal(copyCombatMapElementFromSvg(svg, "bounds"), null);
});

test("parseCombatMapElementTag reads a single svg tag snippet", () => {
  const el = parseCombatMapElementTag(
    `<path name="wall-path" type="barrier" d="M0 0L10 0L10 10Z" ar="15" ssp="100"/>`,
  );
  assert.equal(el?.tag, "path");
  assert.equal(el?.kind, "barrier");
});

test("pasteCombatMapElement duplicates with a new name and offset", () => {
  let svg = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-0",
    name: "room-0",
    x: 100,
    y: 100,
    width: 40,
    height: 30,
  });
  const source = copyCombatMapElementFromSvg(svg, "room-0");
  assert.ok(source);
  const pasted = pasteCombatMapElement(svg, source!);
  assert.ok(pasted);
  svg = pasted!.svg;
  const room = parseCombatMapElements(svg).find((e) => e.id === pasted!.id);
  assert.equal(room?.attrs.name, "room-1");
  assert.equal(room?.attrs.x, "116");
  assert.equal(room?.attrs.y, "116");
});

test("pasteCombatMapElement offsets rotated rects and paths", () => {
  const source = `<rect name="wall-rot" x="100" y="100" width="20" height="80" transform="rotate(90 100 100)" type="barrier" ar="15" ssp="100"/>`;
  const pasted = pasteCombatMapElement(createDefaultCombatMapSvg(), source);
  assert.ok(pasted);
  const wall = parseCombatMapElements(pasted!.svg).find((e) => e.id === pasted!.id);
  assert.equal(wall?.attrs.x, "116");
  assert.equal(wall?.attrs.transform, "rotate(90 116 116)");

  const pathSource = `<path name="wall-path" type="barrier" d="M0 0L10 0L10 10Z" ar="15" ssp="100"/>`;
  const pathPaste = pasteCombatMapElement(createDefaultCombatMapSvg(), pathSource);
  assert.match(
    parseCombatMapElements(pathPaste!.svg).find((e) => e.id === pathPaste!.id)?.attrs.d ?? "",
    /M16 16/,
  );
});

test("combatMapElementToTag roundtrips through parseCombatMapElementTag", () => {
  const el = parseCombatMapElementTag(
    combatMapElementToTag({
      id: "wall-0",
      kind: "barrier",
      tag: "rect",
      attrs: { name: "wall-0", type: "barrier", x: "1", y: "2", width: "3", height: "4" },
    }),
  );
  assert.equal(el?.id, "wall-0");
  assert.equal(el?.attrs.width, "3");
  assert.equal(el?.attrs.height, "4");
});
