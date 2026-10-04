import assert from "node:assert/strict";
import test from "node:test";

import { insertCombatMapRect, parseCombatMapElements } from "./combat-map-document.ts";
import { createDefaultCombatMapSvg } from "./combat-map-document.ts";
import {
  applyCombatMapOobInsideClip,
  COMBAT_MAP_ARTBOARD_CLIP_ID,
  combatMapOutsideArtboardClipPathD,
  elementOutsideArtboard,
  hitOutOfBoundsElementAtPoint,
  oobHoverLabelAnchor,
} from "./combat-map-oob.ts";

const board = { x: 0, y: 0, w: 800, h: 500 };

test("elementOutsideArtboard detects partial and full overflow", () => {
  const inside = parseCombatMapElements(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "room",
      id: "room-in",
      name: "room-in",
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    }),
  ).find((entry) => entry.id === "room-in")!;
  const outside = parseCombatMapElements(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "room",
      id: "room-out",
      name: "room-out",
      x: 790,
      y: 10,
      width: 40,
      height: 40,
    }),
  ).find((entry) => entry.id === "room-out")!;
  assert.equal(elementOutsideArtboard(inside, board), false);
  assert.equal(elementOutsideArtboard(outside, board), true);
});

test("hitOutOfBoundsElementAtPoint prefers the topmost oob element", () => {
  const svg = insertCombatMapRect(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "room",
      id: "room-a",
      name: "room-a",
      x: 790,
      y: 10,
      width: 40,
      height: 40,
    }),
    {
      kind: "barrier",
      id: "wall-a",
      name: "wall-a",
      x: 795,
      y: 15,
      width: 30,
      height: 10,
    },
  );
  const elements = parseCombatMapElements(svg);
  const hit = hitOutOfBoundsElementAtPoint(elements, { x: 800, y: 20 }, board);
  assert.equal(hit?.id, "wall-a");
});

test("applyCombatMapOobInsideClip adds artboard clipPath on oob elements", () => {
  const raw = insertCombatMapRect(createDefaultCombatMapSvg(), {
    kind: "room",
    id: "room-out",
    name: "room-out",
    x: 790,
    y: 10,
    width: 40,
    height: 40,
  });
  const svg = applyCombatMapOobInsideClip(raw, board, ["room-out"]);
  assert.match(svg, new RegExp(`id="${COMBAT_MAP_ARTBOARD_CLIP_ID}"`));
  assert.match(svg, /name="room-out"[^>]*clip-path="url\(#combat-map-artboard-clip\)"/);
});

test("combatMapOutsideArtboardClipPathD punches an artboard hole", () => {
  const d = combatMapOutsideArtboardClipPathD(board);
  assert.match(d, /^M -5000 -5000/);
  assert.match(d, /M 0 0 h 800 v 500/);
});

test("oobHoverLabelAnchor points outside when the center is still in bounds", () => {
  const el = parseCombatMapElements(
    insertCombatMapRect(createDefaultCombatMapSvg(), {
      kind: "barrier",
      id: "wall-0",
      name: "wall-0",
      x: 780,
      y: 100,
      width: 40,
      height: 10,
    }),
  ).find((entry) => entry.id === "wall-0")!;
  const anchor = oobHoverLabelAnchor(el, board);
  assert.ok(anchor);
  assert.ok(anchor.x > board.w || anchor.x < board.x);
});
