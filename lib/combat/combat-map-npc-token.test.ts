import assert from "node:assert/strict";
import test from "node:test";

import { defaultCombatMapMetersPerUnit } from "./combat-map-document.ts";
import {
  COMBAT_MAP_NPC_TOKEN_DIAMETER_M,
  defaultNpcTokenRadiusSvg,
  npcTokenDiameterMFromAttrs,
  patchNpcTokenRadiusFromDiameterM,
  resolvePlayModeTapSelection,
} from "./combat-map-npc-token.ts";

test("defaultNpcTokenRadiusSvg matches configured diameter at map scale", () => {
  const mpu = defaultCombatMapMetersPerUnit();
  const r = defaultNpcTokenRadiusSvg(mpu);
  assert.equal(npcTokenDiameterMFromAttrs({ r: String(r) }, mpu), COMBAT_MAP_NPC_TOKEN_DIAMETER_M);
});

test("patchNpcTokenRadiusFromDiameterM round-trips diameter", () => {
  const mpu = defaultCombatMapMetersPerUnit();
  const r = patchNpcTokenRadiusFromDiameterM("1", mpu);
  assert.equal(r, String(defaultNpcTokenRadiusSvg(mpu) * 2));
  assert.equal(npcTokenDiameterMFromAttrs({ r: r! }, mpu), 1);
});

test("resolvePlayModeTapSelection selects npc on tap and clears on empty tap", () => {
  assert.deepEqual(resolvePlayModeTapSelection(false, "npc-1"), ["npc-1"]);
  assert.deepEqual(resolvePlayModeTapSelection(false, undefined), []);
  assert.equal(resolvePlayModeTapSelection(true, "npc-1"), null);
});
