import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import type { ActionKindId } from "../combat-ai/action-feasibility.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { hasLineOfSight, type Vec2 } from "../combat-ai/visibility.ts";
import {
  applyARangeMovement,
  applySRangeTouch,
  applySoundEvent,
  locRank,
  noteFullContact,
  noteTargetMoved,
  readProjectedIntel,
  senseRanges,
  tickLocalizationDecay,
  decayAfterWait,
  type CombatLocalizationLevel,
  type IntelLocLevel,
  type LocalizationStore,
  type SoundKind,
} from "./localization.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";

export type BenchIntelUnit = {
  id: string;
  team: string;
  position: Vec2;
  difficulty: NpcDifficultyId;
  hearingA: number;
  passiveS: number;
  visionRangeM?: number;
};

export type BenchIntelChannel = "vision" | "hearing" | "sense" | "footstep" | "firearm" | "thrown";

const INTEL_CHANNEL_LABEL: Record<BenchIntelChannel, string> = {
  vision: "视V",
  hearing: "听A",
  sense: "触S",
  footstep: "脚步",
  firearm: "枪声",
  thrown: "投掷",
};

const INTEL_LEVEL_LABEL: Record<Exclude<IntelLocLevel, "none">, string> = {
  approximate: "模糊",
  exact: "精确",
  full: "完全",
};

const INTEL_CHANNEL_ORDER: readonly BenchIntelChannel[] = [
  "vision",
  "sense",
  "hearing",
  "firearm",
  "thrown",
  "footstep",
];

export function formatBenchIntelGainLine(input: {
  observerLabel: string;
  targetLabel: string;
  channels: readonly BenchIntelChannel[];
  level: Exclude<IntelLocLevel, "none">;
}): string {
  const channels = INTEL_CHANNEL_ORDER.filter((ch) => input.channels.includes(ch))
    .map((ch) => INTEL_CHANNEL_LABEL[ch])
    .join("·");
  return `情报 ${input.observerLabel} ${channels} ${input.targetLabel} ${INTEL_LEVEL_LABEL[input.level]}`;
}

function locPairKey(observerId: string, targetId: string): string {
  return `${observerId}>${targetId}`;
}

function snapshotLocRanks(
  store: LocalizationStore,
  units: readonly BenchIntelUnit[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const observer of units) {
    for (const target of units) {
      if (observer.id === target.id) continue;
      const level = readProjectedIntel(
        store,
        observer.team,
        target.id,
        observer.difficulty,
        target.position,
      ).level;
      out.set(locPairKey(observer.id, target.id), locRank(level));
    }
  }
  return out;
}

export function senseFromSheet(sheet: CharacterSheet | undefined) {
  if (!sheet) return senseRanges(3, 3);
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  return senseRanges(summary.baseStats.ref, summary.baseStats.wil);
}

export function viewLocFromProjected(level: IntelLocLevel): CombatLocalizationLevel {
  if (level === "exact" || level === "full") return level;
  return "approximate";
}

export function hasExactOrFullHostileIntel(
  store: LocalizationStore,
  factionId: string,
  difficulty: NpcDifficultyId,
  hostiles: readonly { id: string; position: Vec2 }[],
): boolean {
  return hostiles.some((h) => {
    const level = readProjectedIntel(store, factionId, h.id, difficulty, h.position).level;
    return level === "exact" || level === "full";
  });
}

type VisualUnit = Pick<BenchIntelUnit, "id" | "team" | "position"> & Partial<BenchIntelUnit>;

function sees(observer: VisualUnit, target: VisualUnit, map: CompiledCombatMap): boolean {
  return Math.hypot(observer.position.x - target.position.x, observer.position.y - target.position.y) <=
    (observer.visionRangeM ?? (observer.hearingA ?? 12) * 10) && hasLineOfSight(observer.position, target.position, map.walls);
}

/** Refresh vision and passive S for both moving and stationary observers. */
export function refreshBenchLosIntel(store: LocalizationStore, map: CompiledCombatMap, units: readonly VisualUnit[]) {
  const sensed: { observerId: string; targetId: string }[] = [];
  for (const faction of new Set(units.map(u => u.team))) {
    const observers = units.filter(u => u.team === faction);
    for (const target of units.filter(u => u.team !== faction)) {
      const seeing = observers.filter(u => sees(u, target, map));
      const record = store.records.get(`${faction}\0${target.id}`);
      if (seeing.length === 0 && record?.level === "full" && !record.decayFrozen) {
        record.level = "exact";
        record.exactDecayRoundsLeft = Math.max(...observers.map(u => decayAfterWait(u.difficulty ?? "trained").exactRounds));
      }
      for (const observer of seeing) noteFullContact(store, faction, observer.id, observer.position, target.team, target.id, target.position, true);
      for (const observer of observers) {
        if (observer.passiveS === undefined || observer.difficulty === undefined) continue;
        if (applySRangeTouch({ store, observerFaction: faction, observerPos: observer.position,
          passiveS: observer.passiveS, difficulty: observer.difficulty, targetId: target.id,
          targetPos: target.position, hasLos: seeing.includes(observer) })) {
          sensed.push({ observerId: observer.id, targetId: target.id });
        }
      }
    }
  }
  return sensed;
}

/** Decay once per round and faction; additional teammates do not speed up the clock. */
export function advanceBenchIntelRound(store: LocalizationStore, map: CompiledCombatMap, units: readonly BenchIntelUnit[]): void {
  for (const faction of new Set(units.map(u => u.team))) {
    const observers = units.filter(u => u.team === faction);
    const order = ["newstupid", "novice", "trained", "expert", "professional"];
    const difficulty = observers.reduce((best, u) => order.indexOf(u.difficulty) > order.indexOf(best) ? u.difficulty : best, "newstupid" as NpcDifficultyId);
    for (const target of units.filter(u => u.team !== faction)) {
      tickLocalizationDecay(store, faction, target.id, difficulty, observers.some(u => sees(u, target, map)));
    }
  }
  refreshBenchLosIntel(store, map, units);
}

/** Initialize direct senses. No map → write nothing. */
export function seedBenchLosIntel(
  store: LocalizationStore,
  map: CompiledCombatMap | undefined,
  units: readonly VisualUnit[],
): void {
  if (!map) return;
  refreshBenchLosIntel(store, map, units);
}

function applyHeardSound(
  store: LocalizationStore,
  map: CompiledCombatMap,
  actorId: string,
  actorTeam: string,
  sourcePos: Vec2,
  kind: SoundKind,
  units: readonly BenchIntelUnit[],
  noteChannel: (observerId: string, targetId: string, channel: BenchIntelChannel) => void,
): void {
  for (const observer of units) {
    if (observer.team === actorTeam) continue;
    const heard = applySoundEvent({
      store,
      observerFaction: observer.team,
      observerPos: observer.position,
      hearingA: observer.hearingA,
      difficulty: observer.difficulty,
      sourceId: actorId,
      sourcePos,
      kind,
      barriers: map.barriers,
      walls: map.walls,
    });
    if (heard) noteChannel(observer.id, actorId, kind);
  }
}

export function applyBenchActionIntel(input: {
  store: LocalizationStore;
  map: CompiledCombatMap;
  actorId: string;
  actorTeam: string;
  startPos: Vec2;
  endPos: Vec2;
  kinds: readonly ActionKindId[];
  units: readonly BenchIntelUnit[];
  labelById?: (id: string) => string;
}): string[] {
  const before = snapshotLocRanks(input.store, input.units);
  const channels = new Map<string, BenchIntelChannel[]>();
  const noteChannel = (observerId: string, targetId: string, channel: BenchIntelChannel) => {
    const key = locPairKey(observerId, targetId);
    const list = channels.get(key) ?? [];
    if (!list.includes(channel)) list.push(channel);
    channels.set(key, list);
  };

  const moved = Math.hypot(input.endPos.x - input.startPos.x, input.endPos.y - input.startPos.y) > 1e-6;
  const walls = input.map.walls;

  if (moved) {
    const otherTeams = new Set(input.units.filter((u) => u.team !== input.actorTeam).map((u) => u.team));
    for (const team of otherTeams) {
      noteTargetMoved(input.store, team, input.actorId, input.endPos);
    }
    for (const observer of input.units) {
      if (observer.team === input.actorTeam) continue;
      const hasLos = hasLineOfSight(observer.position, input.endPos, walls);
      if (
        applyARangeMovement({
          store: input.store,
          observerFaction: observer.team,
          observerPos: observer.position,
          hearingA: observer.hearingA,
          difficulty: observer.difficulty,
          targetId: input.actorId,
          track: { start: input.startPos, path: [], end: input.endPos },
          hasLos,
        })
      ) {
        noteChannel(observer.id, input.actorId, "hearing");
      }
    }
    applyHeardSound(
      input.store,
      input.map,
      input.actorId,
      input.actorTeam,
      input.endPos,
      "footstep",
      input.units,
      noteChannel,
    );
    for (const observer of input.units) {
      for (const target of input.units) {
        if (observer.id === target.id || observer.team === target.team) continue;
        if (sees(observer, target, input.map)) {
          noteChannel(observer.id, target.id, "vision");
        }
      }
    }
  }
  for (const sensed of refreshBenchLosIntel(input.store, input.map, input.units)) {
    noteChannel(sensed.observerId, sensed.targetId, "sense");
  }

  if (input.kinds.includes("standard_fire") || input.kinds.includes("suppressive_fire")) {
    applyHeardSound(
      input.store,
      input.map,
      input.actorId,
      input.actorTeam,
      input.endPos,
      "firearm",
      input.units,
      noteChannel,
    );
  }
  if (input.kinds.includes("throw")) {
    applyHeardSound(
      input.store,
      input.map,
      input.actorId,
      input.actorTeam,
      input.endPos,
      "thrown",
      input.units,
      noteChannel,
    );
  }

  const after = snapshotLocRanks(input.store, input.units);
  const name = input.labelById ?? ((id: string) => id);
  const lines: string[] = [];
  for (const observer of input.units) {
    for (const target of input.units) {
      if (observer.id === target.id) continue;
      const key = locPairKey(observer.id, target.id);
      const nextRank = after.get(key) ?? 0;
      const prevRank = before.get(key) ?? 0;
      if (nextRank <= prevRank) continue;
      const level = readProjectedIntel(
        input.store,
        observer.team,
        target.id,
        observer.difficulty,
        target.position,
      ).level;
      if (level === "none") continue;
      lines.push(
        formatBenchIntelGainLine({
          observerLabel: name(observer.id),
          targetLabel: name(target.id),
          channels: channels.get(key) ?? ["vision"],
          level,
        }),
      );
    }
  }
  return lines;
}
