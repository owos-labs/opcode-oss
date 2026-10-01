import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBenchActionIntel,
  advanceBenchIntelRound,
  refreshBenchLosIntel,
  formatBenchIntelGainLine,
  hasExactOrFullHostileIntel,
  seedBenchLosIntel,
  viewLocFromProjected,
} from "./bench-intel.ts";
import { createLocalizationStore, readProjectedIntel } from "./localization.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";

function wallMap(): CompiledCombatMap {
  const wall = { a: { x: 3, y: -10 }, b: { x: 3, y: 10 } };
  return {
    mapId: "wall",
    walls: [wall],
    barriers: [
      {
        id: "w",
        a: wall.a,
        b: wall.b,
        armorRating: 0,
        maxSsp: 0,
        currentSsp: 0,
        blocksVision: true,
      },
    ],
    emplacements: [],
  };
}

function openMap(): CompiledCombatMap {
  return { mapId: "open", walls: [], barriers: [], emplacements: [] };
}

const red = { id: "r1", team: "hostile", position: { x: 0, y: 0 }, difficulty: "trained" as const, hearingA: 20, passiveS: 10 };
const blue = { id: "b1", team: "friendly", position: { x: 6, y: 0 }, difficulty: "trained" as const, hearingA: 20, passiveS: 10 };

test("seedBenchLosIntel does not write full loc through a wall", () => {
  const store = createLocalizationStore("hunt");
  seedBenchLosIntel(store, wallMap(), [red, blue]);
  assert.equal(readProjectedIntel(store, "hostile", "b1", "trained", blue.position).level, "exact");
  assert.equal(hasExactOrFullHostileIntel(store, "hostile", "trained", [blue]), true);
});

test("seedBenchLosIntel writes full loc both ways on open LOS", () => {
  const store = createLocalizationStore("hunt");
  seedBenchLosIntel(store, openMap(), [red, blue]);
  assert.equal(readProjectedIntel(store, "hostile", "b1", "trained", blue.position).level, "full");
  assert.equal(readProjectedIntel(store, "friendly", "r1", "trained", red.position).level, "full");
  assert.equal(hasExactOrFullHostileIntel(store, "hostile", "trained", [blue]), true);
});

test("seedBenchLosIntel without a map writes nothing", () => {
  const store = createLocalizationStore("hunt");
  seedBenchLosIntel(store, undefined, [red, blue]);
  assert.equal(readProjectedIntel(store, "hostile", "b1", "trained", blue.position).level, "none");
});

test("applyBenchActionIntel writes firearm sound through a wall", () => {
  const store = createLocalizationStore("hunt");
  const lines = applyBenchActionIntel({
    store,
    map: wallMap(),
    actorId: red.id,
    actorTeam: red.team,
    startPos: red.position,
    endPos: red.position,
    kinds: ["standard_fire"],
    units: [{ ...red, passiveS: 0 }, { ...blue, passiveS: 0 }],
    labelById: (id) => (id === "r1" ? "红（困难）" : "蓝（困难）"),
  });
  assert.equal(readProjectedIntel(store, "friendly", "r1", "trained", red.position).level, "approximate");
  assert.deepEqual(lines, ["情报 蓝（困难） 枪声 红（困难） 模糊"]);
});

test("formatBenchIntelGainLine names the sense channel", () => {
  assert.equal(
    formatBenchIntelGainLine({
      observerLabel: "Alpha（困难）",
      targetLabel: "Bot（普通）",
      channels: ["vision", "firearm"],
      level: "full",
    }),
    "情报 Alpha（困难） 视V·枪声 Bot（普通） 完全",
  );
});

test("applyBenchActionIntel writes A-range track on a professional hearer", () => {
  const store = createLocalizationStore("hunt");
  const hearer = { ...blue, difficulty: "professional" as const, position: { x: 8, y: 0 } };
  applyBenchActionIntel({
    store,
    map: wallMap(),
    actorId: red.id,
    actorTeam: red.team,
    startPos: { x: 0, y: 0 },
    endPos: { x: 1, y: 0 },
    kinds: ["move"],
    units: [{ ...red, position: { x: 1, y: 0 } }, hearer],
  });
  const proj = readProjectedIntel(store, "friendly", "r1", "professional", { x: 1, y: 0 });
  assert.equal(proj.level, "exact");
  assert.ok(proj.movementTrack);
});

test("viewLocFromProjected never reports none", () => {
  assert.equal(viewLocFromProjected("none"), "approximate");
  assert.equal(viewLocFromProjected("full"), "full");
});

test("vision uses SENS times ten and an unseen move keeps the last observed position", () => {
  const store = createLocalizationStore();
  const observer = { ...red, hearingA: 1, passiveS: 0 };
  const far = { ...blue, position: { x: 11, y: 0 }, hearingA: 1, passiveS: 0 };
  seedBenchLosIntel(store, openMap(), [observer, far]);
  assert.notEqual(readProjectedIntel(store, observer.team, far.id, "trained", far.position).level, "full");
  const seen = { ...far, position: { x: 1, y: 0 } };
  refreshBenchLosIntel(store, openMap(), [observer, seen]);
  const hidden = { ...far, position: { x: 100, y: 0 } };
  applyBenchActionIntel({ store, map: wallMap(), actorId: hidden.id, actorTeam: hidden.team, startPos: seen.position, endPos: hidden.position, kinds: ["move"], units: [observer, hidden] });
  const intel = readProjectedIntel(store, observer.team, hidden.id, "trained", hidden.position);
  assert.equal(intel.level, "exact");
  assert.deepEqual(intel.lastKnownPosition, seen.position);
  advanceBenchIntelRound(store, wallMap(), [observer, hidden]);
  advanceBenchIntelRound(store, wallMap(), [observer, hidden]);
  assert.equal(readProjectedIntel(store, observer.team, hidden.id, "trained", hidden.position).level, "approximate");
});

test("a teammate retaining vision prevents faction intel from decaying", () => {
  const store = createLocalizationStore();
  const ally = { ...red, id: "r2", position: { x: 5, y: 0 } };
  refreshBenchLosIntel(store, wallMap(), [red, ally, blue]);
  advanceBenchIntelRound(store, wallMap(), [red, ally, blue]);
  assert.equal(readProjectedIntel(store, red.team, blue.id, "trained", blue.position).level, "full");
});

test("a moving observer senses a stationary enemy through a wall and keeps sensing it next round", () => {
  const store = createLocalizationStore();
  const observer = { ...red, difficulty: "professional" as const, position: { x: 1, y: 0 }, passiveS: 6 };
  const target = { ...blue, hearingA: 0, passiveS: 0 };
  const lines = applyBenchActionIntel({ store, map: wallMap(), actorId: observer.id, actorTeam: observer.team,
    startPos: { x: -10, y: 0 }, endPos: observer.position, kinds: ["move"], units: [observer, target] });
  const intel = () => readProjectedIntel(store, observer.team, target.id, observer.difficulty, target.position);
  assert.equal(intel().level, "exact");
  assert.deepEqual(intel().lastKnownPosition, target.position);
  assert.ok(lines.some(line => line.includes("触S")));
  for (let round = 0; round < 5; round++) advanceBenchIntelRound(store, wallMap(), [observer, target]);
  assert.equal(intel().level, "exact");
});
