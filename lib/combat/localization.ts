import type { CombatLocalizationLevel, CoverHeightBand } from "../combat-ai/cover-concealment-view.ts";
import { orderedBarrierHits, type BallisticBarrier } from "../combat-ai/geometry.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import {
  hasLineOfSight,
  segmentsIntersect,
  type Vec2,
  type WallSegment,
} from "../combat-ai/visibility.ts";
import { coverHeightHitDifficultyAdd } from "./cover-height.ts";

export type { CombatLocalizationLevel };

export const FUZZY_OFFSET_M = 2.5;
const EPS = 1e-6;

export type EncounterMission = "hold" | "hunt" | "extract" | "seize";
export type IntelLocLevel = CombatLocalizationLevel | "none";
export type SoundKind = "footstep" | "firearm" | "thrown";
export type AwarenessOutcome = "fail" | "approximate" | "exact" | "full";

export type MovementTrack = {
  start: Vec2;
  path: readonly Vec2[];
  end: Vec2;
};

export type GearIntel = {
  weaponRangeM: number;
  weaponLabel?: string;
  armorByPart?: Record<string, number>;
};

export type CombatModIntel = {
  attack: number;
  defense: number;
  damagePerHit?: number;
};

/** Facts written into the store; readers project by loc + difficulty. */
export type IntelFacts = {
  present?: boolean;
  outgoingDamage?: number;
  initiative?: number;
  knownCombatLocation?: Vec2;
  oneWallShooterUntilMove?: CombatLocalizationLevel;
  incomingDamage?: number;
  gear?: GearIntel;
  combatMods?: CombatModIntel;
  hitPoints?: number;
  movementTrack?: MovementTrack;
};

export type IntelRecord = IntelFacts & {
  targetId: string;
  observerFaction: string;
  level: IntelLocLevel;
  stickyOffset: Vec2;
  hasBeenCombatant: boolean;
  decayFrozen: boolean;
  exactDecayRoundsLeft: number;
  fuzzyDecayRoundsLeft: number;
  lastKnownPosition?: Vec2;
};

export type ProjectedIntel = IntelFacts & {
  targetId: string;
  level: IntelLocLevel;
  fuzzyReportPoint?: Vec2;
  hasBeenCombatant: boolean;
  decayFrozen: boolean;
  exactDecayRoundsLeft: number;
  fuzzyDecayRoundsLeft: number;
  lastKnownPosition?: Vec2;
};

export type LocalizationStore = {
  mission: EncounterMission;
  records: Map<string, IntelRecord>;
};

export function canImmediateDirectFire(level: IntelLocLevel): boolean {
  return level === "full" || level === "exact";
}

export function localizationHitDifficultyAdd(level: CombatLocalizationLevel): number {
  if (level === "approximate") return 10;
  if (level === "exact") return 5;
  return 0;
}

export function targetCoverHitDifficultyAdd(coverBand: CoverHeightBand | undefined): number {
  if (!coverBand || coverBand === "none") return 0;
  return coverHeightHitDifficultyAdd(coverBand);
}

/** Walls block full only; far side max exact (Q28). */
export function capLocalizationByLos(level: IntelLocLevel, hasLos: boolean): IntelLocLevel {
  if (level === "none") return "none";
  if (hasLos) return level;
  return level === "full" ? "exact" : level;
}

export function senseRanges(ref: number, wil: number): {
  sens: number;
  hearingA: number;
  openVisionV: number;
  passiveS: number;
} {
  const sens = (ref + wil) * 2;
  return { sens, hearingA: sens, openVisionV: sens * 10, passiveS: sens * 0.5 };
}

export function missionFromEncounter(mission: EncounterMission | undefined): EncounterMission {
  return mission ?? "hunt";
}

export function locRank(level: IntelLocLevel): number {
  if (level === "full") return 3;
  if (level === "exact") return 2;
  if (level === "approximate") return 1;
  return 0;
}

function higherLoc(a: IntelLocLevel, b: IntelLocLevel): IntelLocLevel {
  return locRank(a) >= locRank(b) ? a : b;
}

export function decayAfterWait(difficulty: NpcDifficultyId): {
  exactRounds: number;
  fuzzyRounds: number;
  decays: boolean;
} {
  if (difficulty === "newstupid") return { exactRounds: 0, fuzzyRounds: 0, decays: false };
  if (difficulty === "professional") return { exactRounds: 3, fuzzyRounds: 1, decays: true };
  return { exactRounds: 1, fuzzyRounds: 1, decays: true };
}

function recordKey(factionId: string, targetId: string): string {
  return `${factionId}\0${targetId}`;
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stickyOffsetFor(factionId: string, targetId: string): Vec2 {
  const u = hash32(`${factionId}:${targetId}`) / 4294967296;
  const a = u * Math.PI * 2;
  return { x: Math.cos(a) * FUZZY_OFFSET_M, y: Math.sin(a) * FUZZY_OFFSET_M };
}

export function createLocalizationStore(mission: EncounterMission = "hunt"): LocalizationStore {
  return { mission: missionFromEncounter(mission), records: new Map() };
}

function ensureRecord(store: LocalizationStore, factionId: string, targetId: string): IntelRecord {
  const k = recordKey(factionId, targetId);
  const existing = store.records.get(k);
  if (existing) return existing;
  const rec: IntelRecord = {
    targetId,
    observerFaction: factionId,
    level: "none",
    stickyOffset: stickyOffsetFor(factionId, targetId),
    hasBeenCombatant: false,
    decayFrozen: false,
    exactDecayRoundsLeft: 0,
    fuzzyDecayRoundsLeft: 0,
  };
  store.records.set(k, rec);
  return rec;
}

export function raiseLocalization(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  level: CombatLocalizationLevel,
  truePos: Vec2,
  opts?: { hasLos?: boolean; difficulty?: NpcDifficultyId },
): IntelLocLevel {
  const capped = capLocalizationByLos(level, opts?.hasLos !== false);
  if (capped === "none") return "none";
  const rec = ensureRecord(store, factionId, targetId);
  rec.level = higherLoc(rec.level, capped);
  if (opts?.difficulty) {
    const decay = decayAfterWait(opts.difficulty);
    if (locRank(capped) >= 2) rec.exactDecayRoundsLeft = Math.max(rec.exactDecayRoundsLeft, decay.exactRounds);
    rec.fuzzyDecayRoundsLeft = Math.max(rec.fuzzyDecayRoundsLeft, decay.fuzzyRounds);
  }
  if (capped !== "approximate") rec.lastKnownPosition = { x: truePos.x, y: truePos.y };
  if (locRank(rec.level) >= 1) rec.present = true;
  return rec.level;
}

export function seedObserverIntel(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  level: CombatLocalizationLevel,
  truePos: Vec2,
): void {
  raiseLocalization(store, factionId, targetId, level, truePos, { hasLos: true });
  const rec = ensureRecord(store, factionId, targetId);
  rec.hasBeenCombatant = true;
}

export function markCombatant(store: LocalizationStore, factionId: string, targetId: string): void {
  const rec = ensureRecord(store, factionId, targetId);
  rec.hasBeenCombatant = true;
  if (rec.level === "none") rec.level = "approximate";
  rec.present = true;
}

/** Q32: full loc on a target grants both factions approximate of the contact pair. */
export function noteFullContact(
  store: LocalizationStore,
  observerFaction: string,
  observerId: string,
  observerPos: Vec2,
  targetFaction: string,
  targetId: string,
  targetPos: Vec2,
  hasLos: boolean,
): void {
  const gained = raiseLocalization(store, observerFaction, targetId, "full", targetPos, { hasLos });
  if (gained !== "full") return;
  markCombatant(store, observerFaction, targetId);
  raiseLocalization(store, targetFaction, observerId, "approximate", observerPos, { hasLos: false });
  markCombatant(store, targetFaction, observerId);
}

export function writeIntelFacts(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  facts: IntelFacts,
): void {
  const rec = ensureRecord(store, factionId, targetId);
  if (facts.present !== undefined) rec.present = facts.present;
  if (facts.outgoingDamage !== undefined) rec.outgoingDamage = facts.outgoingDamage;
  if (facts.initiative !== undefined) rec.initiative = facts.initiative;
  if (facts.knownCombatLocation !== undefined) rec.knownCombatLocation = facts.knownCombatLocation;
  if (facts.oneWallShooterUntilMove !== undefined) {
    rec.oneWallShooterUntilMove = facts.oneWallShooterUntilMove;
  }
  if (facts.incomingDamage !== undefined) rec.incomingDamage = facts.incomingDamage;
  if (facts.gear !== undefined) rec.gear = facts.gear;
  if (facts.combatMods !== undefined) rec.combatMods = facts.combatMods;
  if (facts.hitPoints !== undefined) rec.hitPoints = facts.hitPoints;
  if (facts.movementTrack !== undefined) rec.movementTrack = facts.movementTrack;
}

export function fuzzyReportPoint(truePos: Vec2, stickyOffset: Vec2): Vec2 {
  return { x: truePos.x + stickyOffset.x, y: truePos.y + stickyOffset.y };
}

export function readProjectedIntel(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  difficulty: NpcDifficultyId,
  truePos: Vec2,
): ProjectedIntel {
  const rec = store.records.get(recordKey(factionId, targetId));
  if (!rec || rec.level === "none") {
    return {
      targetId,
      level: "none",
      hasBeenCombatant: rec?.hasBeenCombatant ?? false,
      decayFrozen: rec?.decayFrozen ?? false,
      exactDecayRoundsLeft: rec?.exactDecayRoundsLeft ?? 0,
      fuzzyDecayRoundsLeft: rec?.fuzzyDecayRoundsLeft ?? 0,
      lastKnownPosition: rec?.lastKnownPosition,
      fuzzyReportPoint: rec ? fuzzyReportPoint(truePos, rec.stickyOffset) : undefined,
    };
  }

  const out: ProjectedIntel = {
    targetId,
    level: rec.level,
    fuzzyReportPoint: fuzzyReportPoint(truePos, rec.stickyOffset),
    hasBeenCombatant: rec.hasBeenCombatant,
    decayFrozen: rec.decayFrozen,
    exactDecayRoundsLeft: rec.exactDecayRoundsLeft,
    fuzzyDecayRoundsLeft: rec.fuzzyDecayRoundsLeft,
    lastKnownPosition: rec.lastKnownPosition,
  };

  if (locRank(rec.level) < 1) return out;

  out.present = rec.present;
  out.outgoingDamage = rec.outgoingDamage;
  out.knownCombatLocation = rec.knownCombatLocation;
  out.oneWallShooterUntilMove = rec.oneWallShooterUntilMove;
  out.movementTrack = rec.movementTrack;
  if (difficulty !== "newstupid") out.initiative = rec.initiative;

  if (locRank(rec.level) < 2) return out;

  out.incomingDamage = rec.incomingDamage;
  if (difficulty === "trained" || difficulty === "professional") out.hitPoints = rec.hitPoints;
  if (difficulty === "expert" || difficulty === "professional") out.combatMods = rec.combatMods;
  if (difficulty === "professional") out.gear = rec.gear;
  return out;
}

export function setDecayFrozen(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  frozen: boolean,
): void {
  ensureRecord(store, factionId, targetId).decayFrozen = frozen;
}

export function endWaitArmDecay(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  difficulty: NpcDifficultyId,
): void {
  const rec = ensureRecord(store, factionId, targetId);
  rec.decayFrozen = false;
  const d = decayAfterWait(difficulty);
  rec.exactDecayRoundsLeft = d.exactRounds;
  rec.fuzzyDecayRoundsLeft = d.fuzzyRounds;
}

export function tickLocalizationDecay(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  difficulty: NpcDifficultyId,
  hasLos: boolean,
): void {
  const rec = store.records.get(recordKey(factionId, targetId));
  if (!rec || rec.level === "none") return;
  if (rec.decayFrozen) return;
  if (hasLos) return;
  if (!decayAfterWait(difficulty).decays) return;

  if (rec.level === "full") {
    rec.level = "exact";
    return;
  }
  if (rec.level === "exact") {
    if (rec.exactDecayRoundsLeft > 0) {
      rec.exactDecayRoundsLeft -= 1;
      return;
    }
    rec.level = "approximate";
    return;
  }
  if (rec.fuzzyDecayRoundsLeft > 0) {
    rec.fuzzyDecayRoundsLeft -= 1;
    return;
  }
  if (!rec.hasBeenCombatant) rec.level = "none";
}

export function soundRangeAfterBarriers(
  baseRangeM: number,
  hits: readonly { armorRating: number; currentSsp: number }[],
): number {
  let ar = 0;
  let ssp = 0;
  for (const hit of hits) {
    ar += Math.max(0, hit.armorRating);
    ssp += Math.max(0, hit.currentSsp);
  }
  const halvings = Math.floor(ar / 100) + Math.floor(ssp / 20);
  return baseRangeM / 2 ** halvings;
}

export function hearingRangeForSound(hearingA: number, kind: SoundKind): number {
  return kind === "firearm" ? hearingA * 5 : hearingA;
}

export function visionWallCount(from: Vec2, to: Vec2, walls: readonly WallSegment[]): number {
  let n = 0;
  for (const wall of walls) {
    if (segmentsIntersect(from, to, wall.a, wall.b)) n += 1;
  }
  return n;
}

function aRangeMoveLoc(difficulty: NpcDifficultyId): CombatLocalizationLevel | null {
  if (difficulty === "professional") return "exact";
  if (difficulty === "expert" || difficulty === "trained") return "approximate";
  return null;
}

function sRangeTouchLoc(difficulty: NpcDifficultyId): CombatLocalizationLevel {
  return difficulty === "professional" ? "full" : "exact";
}

function oneWallShooterLoc(difficulty: NpcDifficultyId): CombatLocalizationLevel | null {
  if (difficulty === "professional") return "exact";
  if (difficulty === "expert" || difficulty === "trained") return "approximate";
  return null;
}

function pointInRange(a: Vec2, b: Vec2, rangeM: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= rangeM + EPS;
}

export function applySoundEvent(input: {
  store: LocalizationStore;
  observerFaction: string;
  observerPos: Vec2;
  hearingA: number;
  difficulty: NpcDifficultyId;
  sourceId: string;
  sourcePos: Vec2;
  kind: SoundKind;
  barriers: readonly BallisticBarrier[];
  walls?: readonly WallSegment[];
  awareness?: AwarenessOutcome;
}): boolean {
  const hits = orderedBarrierHits(input.observerPos, input.sourcePos, input.barriers);
  const range = soundRangeAfterBarriers(hearingRangeForSound(input.hearingA, input.kind), hits);
  const dist = Math.hypot(input.sourcePos.x - input.observerPos.x, input.sourcePos.y - input.observerPos.y);
  if (dist > range + EPS) return false;

  const walls = input.walls ?? input.barriers.filter((b) => b.blocksVision);
  const hasLos = hasLineOfSight(input.observerPos, input.sourcePos, walls);
  raiseLocalization(input.store, input.observerFaction, input.sourceId, "approximate", input.sourcePos, {
    hasLos, difficulty: input.difficulty,
  });
  if (input.kind === "firearm" || input.kind === "thrown") {
    writeIntelFacts(input.store, input.observerFaction, input.sourceId, {
      knownCombatLocation: { x: input.sourcePos.x, y: input.sourcePos.y },
    });
  }

  const oneWall = oneWallShooterLoc(input.difficulty);
  if (
    input.kind === "firearm" &&
    oneWall &&
    visionWallCount(input.observerPos, input.sourcePos, walls) === 1 &&
    pointInRange(input.observerPos, input.sourcePos, input.hearingA)
  ) {
    raiseLocalization(input.store, input.observerFaction, input.sourceId, oneWall, input.sourcePos, {
      hasLos, difficulty: input.difficulty,
    });
    writeIntelFacts(input.store, input.observerFaction, input.sourceId, {
      oneWallShooterUntilMove: oneWall,
    });
  }

  if (input.difficulty === "newstupid" || !input.awareness || input.awareness === "fail") {
    return true;
  }
  let gained: CombatLocalizationLevel = input.awareness;
  if (input.difficulty === "novice" && gained === "full") gained = "exact";
  raiseLocalization(input.store, input.observerFaction, input.sourceId, gained, input.sourcePos, { hasLos, difficulty: input.difficulty });
  return true;
}

export function applyARangeMovement(input: {
  store: LocalizationStore;
  observerFaction: string;
  observerPos: Vec2;
  hearingA: number;
  difficulty: NpcDifficultyId;
  targetId: string;
  track: MovementTrack;
  hasLos?: boolean;
}): boolean {
  const points = [input.track.start, ...input.track.path, input.track.end];
  if (!points.some((p) => pointInRange(input.observerPos, p, input.hearingA))) return false;
  writeIntelFacts(input.store, input.observerFaction, input.targetId, { movementTrack: input.track });
  const loc = aRangeMoveLoc(input.difficulty);
  if (!loc) return false;
  raiseLocalization(input.store, input.observerFaction, input.targetId, loc, input.track.end, {
    hasLos: input.hasLos !== false, difficulty: input.difficulty,
  });
  return true;
}

export function applySRangeTouch(input: {
  store: LocalizationStore;
  observerFaction: string;
  observerPos: Vec2;
  passiveS: number;
  difficulty: NpcDifficultyId;
  targetId: string;
  targetPos: Vec2;
  hasLos?: boolean;
}): boolean {
  if (!pointInRange(input.observerPos, input.targetPos, input.passiveS)) return false;
  raiseLocalization(
    input.store,
    input.observerFaction,
    input.targetId,
    sRangeTouchLoc(input.difficulty),
    input.targetPos,
    { hasLos: input.hasLos !== false, difficulty: input.difficulty },
  );
  return true;
}

export function noteTargetMoved(
  store: LocalizationStore,
  factionId: string,
  targetId: string,
  _truePos?: Vec2,
): void {
  const rec = store.records.get(recordKey(factionId, targetId));
  if (!rec) return;
  void _truePos; // Movement alone does not reveal a position.
  rec.oneWallShooterUntilMove = undefined;
  rec.movementTrack = undefined;
}
