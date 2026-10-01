import { ACTION_KINDS, actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { decideRoundPlan } from "../combat-ai/decide.ts";
import {
  describePlanStep as describePlanStepText,
  formatPlanMoveDebug,
  planStayReason,
} from "./combat-plan-intent.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { formatUnitDifficultyName, type NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { createPlanningBundle, mulberry32, prepareOptionsForSearch } from "../combat-ai/planning.ts";
import {
  bestStandardFireUtility,
  buildPlanningPayload,
  type PlanningPayload,
} from "./build-planning-payload.ts";
import {
  applyBenchActionIntel,
  advanceBenchIntelRound,
  hasExactOrFullHostileIntel,
  seedBenchLosIntel,
  senseFromSheet,
  viewLocFromProjected,
  type BenchIntelUnit,
} from "./bench-intel.ts";
import {
  createLocalizationStore,
  readProjectedIntel,
  writeIntelFacts,
  type LocalizationStore,
} from "./localization.ts";
import { combatMapWalkWalls, type CompiledCombatMap } from "./map-adapter/compile.ts";
import {
  armorByPartFromCharacterSheet,
  combatSnapshotFromCharacterSheet,
  selectPrimaryRangedWeapon,
} from "./character-sheet-snapshot.ts";
import { readOpcodeInventory } from "../character-sheets/opcodeInventory.ts";
import {
  resolveBenchStandardFire,
  resolveBenchSuppressiveFire,
  suppressiveRoundsSpentForSnapshot,
} from "./combat-bench-fire-damage.ts";
import {
  describeSuppressiveFireAmmo,
  formatAttackChoiceReason,
  scoreSuppressiveFire,
} from "./actions/suppressive-action.ts";
import { hasLineOfSight } from "../combat-ai/visibility.ts";
import { benchHealthFromSheet } from "./combat-bench-health.ts";
import { expectedOpcodeDamage } from "./damage-roll.ts";
import { rangedAttackCheckTerms } from "./ranged-attack-roll.ts";
import {
  rangedShooterAttackBonus,
  rangedShooterAttackParts,
} from "./ranged-shooter-bonus.ts";
import {
  buildDeclaredStandardActionsByPlacement,
  rangedAttackMalusParts,
  standardFiresDeclaredInPlan,
} from "./standard-action-malus.ts";
import { planStandardFire, standardFireTargetDistance } from "./fire-mode.ts";
import {
  appendCombatBenchStepLog,
  type BenchDiceRollRecord,
  type CombatBenchStepLogEntry,
} from "./combat-bench-step-log.ts";
import { parseSvgViewBox, type SvgViewBox } from "./combat-test-scene.ts";
import {
  GAIT_MOVE_MULT,
  tickNonCombat,
  type NonCombatState,
  type TickNonCombatResult,
} from "./non-combat-fsm.ts";
import { buildEncounterNav, buildHuntPatrolRoute, type EncounterNav, type HuntPatrolRoute } from "./patrol.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import {
  athleticsFromSheet,
  buildCombatTurnSequence,
  maxPlanInitiativeSlot,
  placementProfileId,
  refFromSheet,
  rollInitiativeOrder,
  type CombatTurnStep,
  type InitiativeRollEntry,
} from "./combat-bench-initiative.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import { stepAlongWalk } from "../combat-ai/walk-path.ts";
import {
  evaluateBenchCombatOutcome,
  initBenchPlacementHealth,
  placementIsNeutralized,
  type BenchCombatOutcome,
  type BenchPlacementHealthState,
} from "./combat-bench-outcome.ts";
import {
  attachActorHealthToSnapshot,
  combatHealthFieldsFromBench,
  opcodeSaveStatsFromSheet,
} from "./combat-target-health.ts";
import { initiativeCostOfStandardAction } from "./initiative.ts";
import {
  topScoredOptionRows,
  type BenchTopOptionRow,
} from "./combat-bench-top-options.ts";

export const BENCH_TOP_OPTIONS_N = 5;

export type { CombatBenchTeam, CombatMapPlacement } from "./combat-bench-placements.ts";
export {
  benchStartValidation,
  defaultDeciderPlacementId,
  dropPointFromClientOffset,
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
} from "./combat-bench-placements.ts";

export type PlacementBenchPlan = {
  snapshot: CombatSnapshot;
  payload: PlanningPayload;
  plan: RoundPlan;
};

export type BenchFsmMemory = {
  patrolIndex: number;
  state: NonCombatState;
  huntRoute?: HuntPatrolRoute;
};

export type CombatBenchSession = {
  deciderPlacementId: string;
  randomSeed: number;
  /** Turn order after REF+1d6 (seeded). */
  initiativeOrder: InitiativeRollEntry[];
  /** Flat sequence: each entry = one NPC's actions in one initiative segment. */
  turnSequence: CombatTurnStep[];
  turnIndex: number;
  plansByPlacementId: Record<string, PlacementBenchPlan>;
  topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]>;
  /** Current 3-second combat round (1.7). */
  combatRound: number;
  healthByPlacementId: Record<string, import("./combat-bench-outcome.ts").BenchPlacementHealthState>;
  combatEnded: boolean;
  endReason: BenchCombatOutcome["reason"] | null;
  intel: LocalizationStore;
  fsmByPlacementId: Record<string, BenchFsmMemory>;
  stepLog: readonly CombatBenchStepLogEntry[];
  lastCompletedSlotByPlacementId: Record<string, number>;
};

export type { CombatBenchStepLogEntry } from "./combat-bench-step-log.ts";

export function activePlacementPlan(session: CombatBenchSession): PlacementBenchPlan | null {
  const turn = session.turnSequence[session.turnIndex];
  if (!turn) return session.plansByPlacementId[session.deciderPlacementId] ?? null;
  return session.plansByPlacementId[turn.placementId] ?? null;
}

export { actionKindLabel, describePlanStep, planIntentRows, type PlanIntentRow } from "./combat-plan-intent.ts";

function hostilePlacements(decider: CombatMapPlacement, placements: readonly CombatMapPlacement[]) {
  return placements.filter((p) => p.id !== decider.id && p.team !== decider.team);
}

function benchUnitsFromPlacements(
  placements: readonly CombatMapPlacement[],
  sheetById: ReadonlyMap<string, CharacterSheet>,
): BenchIntelUnit[] {
  return placements.map((p) => {
    const sense = senseFromSheet(sheetById.get(p.sheetId));
    return {
      id: p.id,
      team: p.team,
      position: { x: p.x, y: p.y },
      difficulty: placementProfileId(p),
      hearingA: sense.hearingA,
      visionRangeM: sense.openVisionV,
      passiveS: sense.passiveS,
    };
  });
}

function targetViewsFromIntel(input: {
  decider: CombatMapPlacement;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  intel: LocalizationStore;
  difficulty: NpcDifficultyId;
  healthByPlacementId?: Readonly<Record<string, BenchPlacementHealthState>>;
}): CombatTargetView[] {
  return hostilePlacements(input.decider, input.placements).map((p) => {
    const position = { x: p.x, y: p.y };
    const projected = readProjectedIntel(input.intel, input.decider.team, p.id, input.difficulty, position);
    const sheet = input.sheetById.get(p.sheetId);
    const healthFields = combatHealthFieldsFromBench(
      input.healthByPlacementId?.[p.id],
      sheet,
    );
    return {
      id: p.id,
      position,
      localization: viewLocFromProjected(projected.level),
      armorByPart: projected.gear?.armorByPart ?? {},
      attackBonus: projected.combatMods?.attack,
      reflexSaveBonus: projected.combatMods?.defense,
      damagePerHit: projected.combatMods?.damagePerHit,
      weaponRangeM: projected.gear?.weaponRangeM,
      healthMode: healthFields.healthMode ?? benchHealthFromSheet(sheet, p.label)?.mode,
      maxHp: healthFields.maxHp,
      parts: healthFields.parts,
      vitals: healthFields.vitals,
      saveStats: healthFields.saveStats,
      coverId: null,
    };
  });
}

export function buildBenchSnapshot(input: {
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  deciderPlacementId: string;
  profileId?: NpcDifficultyId;
  map?: CompiledCombatMap;
  intel?: LocalizationStore;
  initiativeTotal?: number;
  healthByPlacementId?: CombatBenchSession["healthByPlacementId"];
}): CombatSnapshot {
  const decider = input.placements.find((p) => p.id === input.deciderPlacementId);
  if (!decider) throw new Error("decider placement missing");
  const profileId = input.profileId ?? placementProfileId(decider);
  const npcSheet = input.sheetById.get(decider.sheetId);
  if (!npcSheet) throw new Error("decider sheet missing");

  const intel = input.intel ?? createLocalizationStore("hunt");
  seedBenchLosIntel(intel, input.map, benchUnitsFromPlacements(input.placements, input.sheetById));

  for (const p of input.placements) {
    const sheet = input.sheetById.get(p.sheetId);
    if (!sheet) continue;
    const weapon = selectPrimaryRangedWeapon(readOpcodeInventory(sheet.status));
    const health = input.healthByPlacementId?.[p.id]?.current ?? benchHealthFromSheet(sheet, p.label)?.simpleCurrent;
    const ammo = weapon ? combatSnapshotFromCharacterSheet(sheet, { position: { x: p.x, y: p.y }, targets: [] }).ammo : undefined;
    writeIntelFacts(intel, decider.team, p.id, {
      hitPoints: health ?? undefined,
      combatMods: { attack: rangedShooterAttackBonus(rangedShooterAttackParts(sheet, weapon?.weapon?.skills ?? []), 0),
        defense: refFromSheet(sheet) + athleticsFromSheet(sheet), damagePerHit: ammo ? expectedOpcodeDamage(ammo.damageDiceExpr || `${ammo.expectedDamageDice}d6`) : 0 },
      gear: {
        weaponRangeM: Number(weapon?.weapon?.range) || 0,
        armorByPart: armorByPartFromCharacterSheet(sheet),
      },
    });
  }
  const targets = targetViewsFromIntel({
    decider,
    placements: input.placements,
    sheetById: input.sheetById,
    intel,
    difficulty: profileId,
    healthByPlacementId: input.healthByPlacementId,
  });

  const snapshot = combatSnapshotFromCharacterSheet(npcSheet, {
    actorId: decider.id,
    position: { x: decider.x, y: decider.y },
    targets,
    intel,
    factionId: decider.team,
    ...(input.initiativeTotal !== undefined ? { initiativeTotal: input.initiativeTotal } : {}),
    encounter: {
      profileId,
      allowNpcSurrender: false,
      surrenderThreshold: -Infinity,
      mission: "hunt",
    },
  });
  snapshot.armorByPart = armorByPartFromCharacterSheet(npcSheet);
  snapshot.hitPoints = input.healthByPlacementId?.[decider.id]?.current ?? snapshot.hitPoints;
  const withHealth = attachActorHealthToSnapshot(
    snapshot,
    input.healthByPlacementId?.[decider.id],
    npcSheet,
  );
  Object.assign(snapshot, withHealth);
  snapshot.allyCount = input.placements.filter(p => {
    if (p.team !== decider.team || placementIsNeutralized(input.healthByPlacementId?.[p.id])) return false;
    if (p.id === decider.id || profileId === "trained" || profileId === "novice" || profileId === "newstupid") return true;
    return targets.some(t => {
      if (t.localization !== "exact" && t.localization !== "full") return false;
      const visible = !input.map || hasLineOfSight({ x: p.x, y: p.y }, t.position, input.map.walls);
      return profileId === "expert" ? visible : visible || Math.hypot(p.x - t.position.x, p.y - t.position.y) <= snapshot.mov;
    });
  }).length;
  return snapshot;
}

function emptyRoundPlan(snapshot: CombatSnapshot, randomSeed: number): RoundPlan {
  return {
    snapshotVersion: snapshot.snapshotVersion,
    randomSeed,
    actions: [],
    completedDepth: 0,
    totalUtility: 0,
    timedOut: false,
  };
}

function nonCombatMovePlan(
  snapshot: CombatSnapshot,
  payload: PlanningPayload,
  destination: { x: number; y: number } | undefined,
  randomSeed: number,
): RoundPlan {
  if (!destination || payload.stancePositions.length === 0) {
    return emptyRoundPlan(snapshot, randomSeed);
  }
  const here = snapshot.position;
  if (Math.hypot(destination.x - here.x, destination.y - here.y) < 0.5) {
    return emptyRoundPlan(snapshot, randomSeed);
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < payload.stancePositions.length; i++) {
    const stance = payload.stancePositions[i]!;
    const d = Math.hypot(stance.x - destination.x, stance.y - destination.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === 0) return emptyRoundPlan(snapshot, randomSeed);
  return {
    snapshotVersion: snapshot.snapshotVersion,
    randomSeed,
    actions: [
      {
        round: 0,
        kind: actionKindIndex("move"),
        tile: best,
        target: 0,
        timing: "immediate",
      },
    ],
    completedDepth: 1,
    totalUtility: 0,
    timedOut: false,
  };
}

function hostilesForActor(actorId: string, placements: readonly CombatMapPlacement[]) {
  const actor = placements.find((p) => p.id === actorId);
  if (!actor) return [];
  return hostilePlacements(actor, placements).map((p) => ({ id: p.id, position: { x: p.x, y: p.y } }));
}

function tickForSnapshot(input: {
  snapshot: CombatSnapshot;
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  memory?: BenchFsmMemory;
}): TickNonCombatResult {
  const snapshot = input.snapshot;
  const difficulty = snapshot.encounter.profileId;
  const huntRoute =
    input.memory?.huntRoute ??
    (snapshot.nav
      ? buildHuntPatrolRoute({
          nav: snapshot.nav,
          origin: snapshot.position,
          difficulty,
          rng: mulberry32(input.randomSeed),
          walls: input.map.walls,
        })
      : undefined);
  const squad = input.placements
    .filter((p) => p.team === snapshot.factionId)
    .map((p) => ({
      id: p.id,
      difficulty: placementProfileId(p),
      position: { x: p.x, y: p.y },
    }));
  return tickNonCombat({
    unitId: snapshot.actorId,
    position: snapshot.position,
    difficulty,
    state: input.memory?.state,
    patrolIndex: input.memory?.patrolIndex,
    huntRoute,
    squad,
    store: snapshot.intel,
    factionId: snapshot.factionId,
    hostileRefs: hostilesForActor(snapshot.actorId, input.placements),
    nav: snapshot.nav,
    map: input.map,
    rng: mulberry32(input.randomSeed ^ snapshot.actorId.length),
  });
}

function decideOrTickPlan(input: {
  snapshot: CombatSnapshot;
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  memory?: BenchFsmMemory;
}): { snapshot: CombatSnapshot; payload: PlanningPayload; plan: RoundPlan; memory?: BenchFsmMemory } {
  let snapshot = input.snapshot;
  const hostiles = hostilesForActor(snapshot.actorId, input.placements);
  const inCombat =
    snapshot.intel && snapshot.factionId
      ? snapshot.disengaging || hasExactOrFullHostileIntel(snapshot.intel, snapshot.factionId, snapshot.encounter.profileId, hostiles)
      : snapshot.targets.some((t) => t.localization === "exact" || t.localization === "full");

  if (!inCombat) {
    const tick = tickForSnapshot(input);
    if (tick.rebuildNav && tick.nav) snapshot = { ...snapshot, nav: tick.nav };
    else if (tick.rebuildNav) snapshot = { ...snapshot, nav: buildEncounterNav(input.map) };
    const gaitMeters = snapshot.mov * GAIT_MOVE_MULT[tick.gait];
    const extra = tick.destination
      ? [stepAlongWalk(snapshot.position, tick.destination, combatMapWalkWalls(input.map), gaitMeters)]
      : [];
    const payload = buildPlanningPayload(snapshot, input.map, () => 1, extra);
    const plan = nonCombatMovePlan(snapshot, payload, extra[0] ?? tick.destination, input.randomSeed);
    return {
      snapshot,
      payload,
      plan,
      memory: {
        patrolIndex: tick.patrolIndex,
        state: tick.state,
        huntRoute: tick.huntRoute ?? input.memory?.huntRoute,
      },
    };
  }

  const payload = buildPlanningPayload(snapshot, input.map, mulberry32(input.randomSeed));

  const plan = decideRoundPlan({
    profileId: snapshot.encounter.profileId,
    feasibility: payload.feasibility,
    utility: payload.utility,
    randomSeed: input.randomSeed,
    snapshotVersion: snapshot.snapshotVersion,
    allowNpcSurrender: snapshot.encounter.allowNpcSurrender,
    surrenderThreshold: snapshot.encounter.surrenderThreshold,
    maxStandardActions: payload.maxStandardActions,
    locatedPathConditional: payload.locatedPathConditional,
  });
  const declaredStandardActions =
    snapshot.declaredStandardActions ??
    plan.actions.filter(
      (a) =>
        ACTION_KINDS[a.kind] !== "move" &&
        ACTION_KINDS[a.kind] !== "enter_cover" &&
        ACTION_KINDS[a.kind] !== "leave_cover",
    ).length;
  return {
    snapshot: {
      ...snapshot,
      disengaging: payload.holdingDisengage
        ? true
        : payload.favorableReentry
          ? false
          : snapshot.disengaging === true,
      declaredStandardActions,
      declaredStandardFires:
        snapshot.declaredStandardFires ?? standardFiresDeclaredInPlan(plan),
    },
    payload,
    plan,
  };
}

/** Fresh policy rolls each round; replanning the same turn must reuse them. */
function placementRoundSeed(seed: number, round: number, placementId: string): number {
  let value = (seed + Math.imul(round - 1, 0x9e3779b9)) >>> 0;
  for (let i = 0; i < placementId.length; i++) value = (Math.imul(value, 31) + placementId.charCodeAt(i)) >>> 0;
  return value;
}

export function buildPlacementPlans(input: {
  map: CompiledCombatMap;
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  combatRound?: number;
  topN?: number;
  priorSnapshots?: Readonly<Record<string, CombatSnapshot>>;
  healthByPlacementId?: CombatBenchSession["healthByPlacementId"];
  nav?: EncounterNav;
  intel?: LocalizationStore;
  fsmByPlacementId?: Record<string, BenchFsmMemory>;
  initiativeTotalByPlacementId?: Readonly<Record<string, number>>;
}): {
  plansByPlacementId: Record<string, PlacementBenchPlan>;
  topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]>;
  maxSlotByPlacementId: Record<string, number>;
} {
  const topN = input.topN ?? BENCH_TOP_OPTIONS_N;
  const labelById = new Map(input.placements.map((p) => [p.id, p.label]));
  const plansByPlacementId: Record<string, PlacementBenchPlan> = {};
  const topOptionsByPlacementId: Record<string, readonly BenchTopOptionRow[]> = {};
  const maxSlotByPlacementId: Record<string, number> = {};
  const intel = input.intel ?? createLocalizationStore("hunt");
  const fsm = input.fsmByPlacementId ?? {};

  for (const p of input.placements) {
    try {
      const randomSeed = placementRoundSeed(input.randomSeed, input.combatRound ?? 1, p.id);
      const built = {
        ...buildBenchSnapshot({
          sheetById: input.sheetById,
          placements: input.placements,
          deciderPlacementId: p.id,
          map: input.map,
          intel,
          healthByPlacementId: input.healthByPlacementId,
          initiativeTotal: input.initiativeTotalByPlacementId?.[p.id],
        }),
        ...(input.nav ? { nav: input.nav } : {}),
      };
      const prior = input.priorSnapshots?.[p.id];
      if (prior) {
        built.ammo = prior.ammo;
        built.coverId = prior.coverId;
        built.disengaging = prior.disengaging;
        built.targets = built.targets.map(t => ({ ...t, coverId: input.priorSnapshots?.[t.id]?.coverId ?? null }));
        built.sustainedFire = { active: prior.sustainedFire.active, walkFireMalus: 0, token: prior.sustainedFire.token };
      }
      const decided = decideOrTickPlan({
        snapshot: built,
        map: input.map,
        placements: input.placements,
        randomSeed,
        memory: fsm[p.id],
      });
      if (decided.memory) fsm[p.id] = decided.memory;
      plansByPlacementId[p.id] = {
        snapshot: decided.snapshot,
        payload: decided.payload,
        plan: decided.plan,
      };
      maxSlotByPlacementId[p.id] = maxPlanInitiativeSlot(decided.plan);
      const bundle = createPlanningBundle({
        profileId: decided.snapshot.encounter.profileId,
        feasibility: decided.payload.feasibility,
        utility: decided.payload.utility,
        randomSeed,
        snapshotVersion: decided.snapshot.snapshotVersion,
        allowNpcSurrender: decided.snapshot.encounter.allowNpcSurrender,
        surrenderThreshold: decided.snapshot.encounter.surrenderThreshold,
        maxStandardActions: decided.payload.maxStandardActions,
        locatedPathConditional: decided.payload.locatedPathConditional,
      });
      const options = prepareOptionsForSearch(bundle);
      topOptionsByPlacementId[p.id] = topScoredOptionRows(decided.payload, options, topN, (targetId) =>
        targetId ? (labelById.get(targetId) ?? targetId.slice(0, 8)) : "",
      );
    } catch {
      topOptionsByPlacementId[p.id] = [];
      maxSlotByPlacementId[p.id] = -1;
    }
  }
  return { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId };
}

/** @deprecated use buildPlacementPlans */
export function buildTopOptionsByPlacement(input: {
  map: CompiledCombatMap;
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placements: readonly CombatMapPlacement[];
  randomSeed: number;
  topN?: number;
}): Record<string, readonly BenchTopOptionRow[]> {
  return buildPlacementPlans(input).topOptionsByPlacementId;
}

export function startCombatBenchSession(input: {
  map: CompiledCombatMap;
  deciderPlacementId: string;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  randomSeed?: number;
}): CombatBenchSession {
  const randomSeed = input.randomSeed ?? 42;
  const nav = buildEncounterNav(input.map);
  const intel = createLocalizationStore("hunt");
  const fsmByPlacementId: Record<string, BenchFsmMemory> = {};
  const initiativeOrder = rollInitiativeOrder({
    placements: input.placements,
    sheetById: input.sheetById,
    deciderPlacementId: input.deciderPlacementId,
    randomSeed,
  });
  const healthByPlacementId = initBenchPlacementHealth(input.placements, input.sheetById);
  const { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId } = buildPlacementPlans({
    map: input.map,
    sheetById: input.sheetById,
    placements: input.placements,
    randomSeed,
    nav,
    intel,
    fsmByPlacementId,
    healthByPlacementId,
    initiativeTotalByPlacementId: Object.fromEntries(initiativeOrder.map((e) => [e.placementId, e.roll])),
  });
  const turnSequence = buildCombatTurnSequence(initiativeOrder, maxSlotByPlacementId);
  const outcome = evaluateBenchCombatOutcome(input.placements, healthByPlacementId);

  return {
    deciderPlacementId: input.deciderPlacementId,
    randomSeed,
    initiativeOrder,
    turnSequence,
    turnIndex: 0,
    plansByPlacementId,
    topOptionsByPlacementId,
    combatRound: 1,
    healthByPlacementId,
    combatEnded: outcome.ended,
    endReason: outcome.ended ? outcome.reason : null,
    intel,
    fsmByPlacementId,
    stepLog: [],
    lastCompletedSlotByPlacementId: Object.fromEntries(input.placements.map((p) => [p.id, -1])),
  };
}

export function benchCombatEndLabel(reason: BenchCombatOutcome["reason"]): string {
  if (reason === "hostiles_neutralized") return "战斗结束：敌方已无害化";
  if (reason === "friendlies_neutralized") return "战斗结束：友方已无害化";
  if (reason === "faction_eliminated") return "战斗结束：只剩一方可战";
  if (reason === "stalemate") return "战斗结束：双方均无害化";
  return "战斗结束";
}

export function placementPositionsFromSession(
  session: CombatBenchSession,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, bundle] of Object.entries(session.plansByPlacementId)) {
    out[id] = { x: bundle.snapshot.position.x, y: bundle.snapshot.position.y };
  }
  return out;
}

/** Start next 3s combat round: reset per-round mov/initiative and replan from live positions. */
export function advanceCombatBenchRound(input: {
  session: CombatBenchSession;
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
}): CombatBenchSession {
  const outcome = evaluateBenchCombatOutcome(
    input.placements,
    input.session.healthByPlacementId,
  );
  if (outcome.ended) {
    return {
      ...input.session,
      combatEnded: true,
      endReason: outcome.reason,
    };
  }

  const placementsWithPositions = input.placements.map((p) => {
    const pos = input.session.plansByPlacementId[p.id]?.snapshot.position;
    return pos ? { ...p, x: pos.x, y: pos.y } : p;
  });

  advanceBenchIntelRound(input.session.intel, input.map, benchUnitsFromPlacements(
    placementsWithPositions.filter(p => !placementIsNeutralized(input.session.healthByPlacementId[p.id])), input.sheetById));
  const nav = Object.values(input.session.plansByPlacementId)[0]?.snapshot.nav;
  const fsmByPlacementId = { ...input.session.fsmByPlacementId };
  const { plansByPlacementId, topOptionsByPlacementId, maxSlotByPlacementId } = buildPlacementPlans(
    {
      map: input.map,
      sheetById: input.sheetById,
      placements: placementsWithPositions.filter(p => !placementIsNeutralized(input.session.healthByPlacementId[p.id])),
      priorSnapshots: Object.fromEntries(Object.entries(input.session.plansByPlacementId).map(([id, b]) => [id, b.snapshot])),
      healthByPlacementId: input.session.healthByPlacementId,
      randomSeed: input.session.randomSeed,
      combatRound: input.session.combatRound + 1,
      nav,
      intel: input.session.intel,
      fsmByPlacementId,
      initiativeTotalByPlacementId: Object.fromEntries(
        input.session.initiativeOrder.map((e) => [e.placementId, e.roll]),
      ),
    },
  );

  for (const id of Object.keys(plansByPlacementId)) {
    const bundle = plansByPlacementId[id]!;
    const prior = input.session.plansByPlacementId[id]?.snapshot;
    const sustain = prior?.sustainedFire;
    plansByPlacementId[id] = {
      ...bundle,
      snapshot: {
        ...bundle.snapshot,
        metersMovedThisRound: 0,
        weaponRoundsThisRound: 0,
        standardActionsThisRound: 0,
        standardFiresThisRound: 0,
        initiativeRemaining: bundle.snapshot.initiativeTotal,
        ammo: prior?.ammo ?? bundle.snapshot.ammo,
        sustainedFire: sustain?.active
          ? { active: true, walkFireMalus: 0, token: sustain.token }
          : { active: false, walkFireMalus: 0, token: sustain?.token ?? 0 },
      },
    };
  }

  const turnSequence = buildCombatTurnSequence(
    input.session.initiativeOrder,
    maxSlotByPlacementId,
  );

  return {
    ...input.session,
    combatRound: input.session.combatRound + 1,
    plansByPlacementId,
    topOptionsByPlacementId,
    turnSequence,
    turnIndex: 0,
    fsmByPlacementId,
    lastCompletedSlotByPlacementId: Object.fromEntries(
      input.placements.map((p) => [p.id, -1]),
    ),
  };
}

export { applyPlanStepToSnapshot } from "./apply-plan-step.ts";

export type StepBenchResult = {
  session: CombatBenchSession;
  label: string;
  actorPlacementId: string;
  actorPosition: { x: number; y: number };
  /** True only when combat ends (side neutralized), not when a 3s round completes. */
  done: boolean;
  newCombatRound?: number;
};

function attachBenchStepLog(
  next: CombatBenchSession,
  entry: Omit<CombatBenchStepLogEntry, "stepIndex" | "healthByPlacementId">,
): CombatBenchSession {
  return {
    ...next,
    stepLog: appendCombatBenchStepLog(next.stepLog ?? [], {
      ...entry,
      healthByPlacementId: structuredClone(next.healthByPlacementId),
    }),
  };
}

function spendInitiativeForSlot(snapshot: CombatSnapshot, slot: number): CombatSnapshot {
  const cost = initiativeCostOfStandardAction(slot);
  return {
    ...snapshot,
    initiativeRemaining: Math.max(0, snapshot.initiativeRemaining - cost),
  };
}

/** Re-decide with current map positions while keeping spent ammo / initiative / movement. */
export function replanPlacementTurn(input: {
  map: CompiledCombatMap;
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  placementId: string;
  prior: PlacementBenchPlan;
  randomSeed: number;
  memory?: BenchFsmMemory;
  healthByPlacementId?: CombatBenchSession["healthByPlacementId"];
  slot?: number;
  targetCoverIds?: Readonly<Record<string, string | null>>;
}): PlacementBenchPlan & { memory?: BenchFsmMemory } {
  const fresh = buildBenchSnapshot({
    sheetById: input.sheetById,
    placements: input.placements,
    deciderPlacementId: input.placementId,
    map: input.map,
    intel: input.prior.snapshot.intel,
    healthByPlacementId: input.healthByPlacementId,
  });
  const snapshot: CombatSnapshot = {
    ...fresh,
    targets: fresh.targets.map(t => ({ ...t, coverId: input.targetCoverIds?.[t.id] ?? null })),
    initiativeRemaining: input.prior.snapshot.initiativeRemaining,
    initiativeTotal: input.prior.snapshot.initiativeTotal,
    metersMovedThisRound: input.prior.snapshot.metersMovedThisRound,
    weaponRoundsThisRound: input.prior.snapshot.weaponRoundsThisRound,
    standardActionsThisRound: input.prior.snapshot.standardActionsThisRound,
    standardFiresThisRound: input.prior.snapshot.standardFiresThisRound,
    declaredStandardActions: input.prior.snapshot.declaredStandardActions,
    coverId: input.prior.snapshot.coverId,
    disengaging: input.prior.snapshot.disengaging,
    ammo: input.prior.snapshot.ammo,
    sustainedFire: input.prior.snapshot.sustainedFire,
    suppressionActive: input.prior.snapshot.suppressionActive,
    nav: input.prior.snapshot.nav,
    intel: input.prior.snapshot.intel ?? fresh.intel,
    factionId: input.prior.snapshot.factionId ?? fresh.factionId,
  };
  const decided = decideOrTickPlan({
    snapshot,
    map: input.map,
    placements: input.placements,
    randomSeed: input.randomSeed,
    memory: input.memory,
  });
  return {
    snapshot: decided.snapshot,
    payload: decided.payload,
    plan: { ...decided.plan, actions: decided.plan.actions.map(a => ({ ...a, round: a.round + (input.slot ?? 0) })) },
    memory: decided.memory,
  };
}

export function stepCombatBenchSession(
  session: CombatBenchSession,
  context: {
    map: CompiledCombatMap;
    placements: readonly CombatMapPlacement[];
    sheetById: ReadonlyMap<string, CharacterSheet>;
  },
): StepBenchResult {
  if (session.combatEnded) {
    const fallback =
      session.plansByPlacementId[session.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
    return {
      session,
      label: benchCombatEndLabel(session.endReason ?? "stalemate"),
      actorPlacementId: session.deciderPlacementId,
      actorPosition: fallback,
      done: true,
    };
  }

  let working = session;
  let newCombatRound: number | undefined;
  if (working.turnIndex >= working.turnSequence.length) {
    working = advanceCombatBenchRound({
      session: working,
      map: context.map,
      placements: context.placements,
      sheetById: context.sheetById,
    });
    if (working.combatEnded) {
      const fallback =
        working.plansByPlacementId[working.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
      return {
        session: working,
        label: benchCombatEndLabel(working.endReason ?? "stalemate"),
        actorPlacementId: working.deciderPlacementId,
        actorPosition: fallback,
        done: true,
      };
    }
    newCombatRound = working.combatRound;
  }

  const turn = working.turnSequence[working.turnIndex];
  if (!turn) {
    const fallback =
      working.plansByPlacementId[working.deciderPlacementId]?.snapshot.position ?? { x: 0, y: 0 };
    return {
      session: working,
      label: `第 ${working.combatRound} 战斗轮：无行动步进`,
      actorPlacementId: working.deciderPlacementId,
      actorPosition: fallback,
      done: false,
      newCombatRound,
    };
  }

  session = working;
  const turnIndexBefore = session.turnIndex;

  if (placementIsNeutralized(session.healthByPlacementId[turn.placementId])) {
    const pos = session.plansByPlacementId[turn.placementId]?.snapshot.position ?? { x: 0, y: 0 };
    const label = `${turn.label} · 已无害`;
    const next = { ...session, turnIndex: session.turnIndex + 1 };
    return {
      session: attachBenchStepLog(next, {
        combatRound: session.combatRound,
        turnIndexBefore,
        turn,
        label,
        actorPlacementId: turn.placementId,
        actorPosition: pos,
        actionDescriptions: [],
        enteredNewCombatRound: newCombatRound,
      }),
      label,
      actorPlacementId: turn.placementId,
      actorPosition: pos,
      done: false,
      newCombatRound,
    };
  }

  let bundle = session.plansByPlacementId[turn.placementId];
  if (!bundle) {
    const next: CombatBenchSession = { ...session, turnIndex: session.turnIndex + 1 };
    const label = `${turn.label} · 无计划`;
    return {
      session: attachBenchStepLog(next, {
        combatRound: session.combatRound,
        turnIndexBefore,
        turn,
        label,
        actorPlacementId: turn.placementId,
        actorPosition: { x: 0, y: 0 },
        actionDescriptions: [],
        enteredNewCombatRound: newCombatRound,
      }),
      label,
      actorPlacementId: turn.placementId,
      actorPosition: { x: 0, y: 0 },
      done: false,
      newCombatRound,
    };
  }

  const livePlacements = context.placements.map((p) => {
    const pos = session.plansByPlacementId[p.id]?.snapshot.position;
    return pos ? { ...p, x: pos.x, y: pos.y } : p;
  });

  const replanned = replanPlacementTurn({
    map: context.map,
    placements: livePlacements.filter(p => !placementIsNeutralized(session.healthByPlacementId[p.id])),
    sheetById: context.sheetById,
    placementId: turn.placementId,
    prior: bundle,
    slot: turn.slot,
    targetCoverIds: Object.fromEntries(Object.entries(session.plansByPlacementId).map(([id, b]) => [id, b.snapshot.coverId])),
    healthByPlacementId: session.healthByPlacementId,
    randomSeed: bundle.plan.randomSeed,
    memory: session.fsmByPlacementId?.[turn.placementId],
  });
  bundle = replanned;

  const slotActions = bundle.plan.actions.filter((a) => a.round === turn.slot);
  let snapshot = bundle.snapshot;
  const startPos = { x: snapshot.position.x, y: snapshot.position.y };
  const placementLogNames = new Map(
    context.placements.map((p) => [
      p.id,
      formatUnitDifficultyName(p.label, placementProfileId(p)),
    ]),
  );
  const targetLogName = (id: string | null) =>
    id ? (placementLogNames.get(id) ?? id.slice(0, 8)) : "";
  const stayReason = planStayReason({
    payload: bundle.payload,
    actions: bundle.plan.actions,
    slot: turn.slot,
    movRemaining: remainingMoveBudgetMeters(snapshot.mov, snapshot.metersMovedThisRound),
    coverId: snapshot.coverId,
    profileId: snapshot.encounter.profileId,
  });
  const parts = slotActions.map((a) =>
    describePlanStepText(bundle.payload, a, targetLogName, stayReason),
  );
  const movedThisSlot = slotActions.some((a) => {
    if (ACTION_KINDS[a.kind] !== "move" && ACTION_KINDS[a.kind] !== "enter_cover") return false;
    const dest = bundle.payload.stancePositions[a.tile];
    return dest != null && Math.hypot(dest.x - startPos.x, dest.y - startPos.y) >= 1e-3;
  });
  if (!movedThisSlot && !slotActions.some(a => ACTION_KINDS[a.kind] === "move")) {
    parts.unshift(formatPlanMoveDebug(startPos, startPos, stayReason));
  }
  let healthByPlacementId = { ...session.healthByPlacementId };
  const fireDiceRolls: BenchDiceRollRecord[] = [];
  const fireLines: string[] = [];
  const damageRng = mulberry32(
    session.randomSeed + (session.stepLog?.length ?? 0) * 997 + session.turnIndex * 17 + 1,
  );
  const actorSheet = context.sheetById.get(
    context.placements.find((p) => p.id === turn.placementId)?.sheetId ?? "",
  );
  const actorWeapon = actorSheet
    ? selectPrimaryRangedWeapon(readOpcodeInventory(actorSheet.status))
    : null;
  const shooterParts = rangedShooterAttackParts(actorSheet, actorWeapon?.weapon?.skills ?? []);
  const declaredStandardActions =
    snapshot.declaredStandardActions ??
    buildDeclaredStandardActionsByPlacement({
      plansByPlacementId: session.plansByPlacementId,
      placementIds: context.placements.map((p) => p.id),
    })[turn.placementId] ?? 0;
  let priorFireRounds = snapshot.standardFiresThisRound ?? 0;
  const declaredStandardFires =
    snapshot.declaredStandardFires ?? standardFiresDeclaredInPlan(bundle.plan);
  const intel = snapshot.intel ?? session.intel;
  const actor = livePlacements.find((p) => p.id === turn.placementId);
  const intelLines: string[] = [];

  for (const action of slotActions) {
    const actionStart = snapshot.position;
    const kind = ACTION_KINDS[action.kind];
    if (kind === "standard_fire" || kind === "suppressive_fire" || kind === "throw") {
      const choiceSnapshot = {
        ...snapshot,
        metersMovedThisRound: 0,
        standardActionsThisRound: 0,
        declaredStandardActions,
      };
      parts.push(formatAttackChoiceReason({
        chosen: kind,
        suppress: scoreSuppressiveFire(choiceSnapshot, context.map, actionStart),
        bestFire: bestStandardFireUtility(choiceSnapshot, context.map, actionStart),
      }));
    }
    if (kind === "standard_fire") {
      const firePlan = planStandardFire(
        snapshot,
        standardFireTargetDistance(snapshot, bundle.payload, action),
      );
      const malusParts = rangedAttackMalusParts({
        declaredStandardActions,
        declaredStandardFiresInRound: declaredStandardFires,
        priorStandardFiresThisRound: priorFireRounds,
        roundsThisAction: 1,
        fireMode: firePlan.mode,
      });
      const attackBonus = rangedShooterAttackBonus(
        shooterParts,
        malusParts.unified + malusParts.consecutiveFire,
      );
      const targetPlacement = context.placements.find((p) => p.id === (bundle.payload.targetIds[action.target] ?? ""));
      const targetSheet = targetPlacement
        ? context.sheetById.get(targetPlacement.sheetId)
        : undefined;
      const fire = resolveBenchStandardFire({
        snapshot: { ...snapshot, targets: snapshot.targets.map(t => ({ ...t, armorByPart: armorByPartFromCharacterSheet(context.sheetById.get(context.placements.find(p => p.id === t.id)?.sheetId ?? "")) })) },
        payload: bundle.payload,
        action,
        map: context.map,
        healthByPlacementId,
        actorLabel: turn.label,
        targetLabel: (id) => placementLogNames.get(id) ?? id.slice(0, 8),
        attackBonus,
        attackTerms: rangedAttackCheckTerms(shooterParts, malusParts),
        targetSaveStats: opcodeSaveStatsFromSheet(targetSheet),
        rng: damageRng,
      });
      healthByPlacementId = fire.healthByPlacementId;
      fireDiceRolls.push(...fire.diceRolls);
      fireLines.push(...fire.lines);
      priorFireRounds += 1;
    } else if (kind === "suppressive_fire") {
      const spent = suppressiveRoundsSpentForSnapshot(snapshot);
      const malusParts = rangedAttackMalusParts({
        declaredStandardActions,
        priorStandardFiresThisRound: 0,
        roundsThisAction: 1,
      });
      const suppressMalus = { unified: malusParts.unified, consecutiveFire: 0 };
      const attackBonus = rangedShooterAttackBonus(shooterParts, suppressMalus.unified);
      const suppress = resolveBenchSuppressiveFire({
        snapshot: { ...snapshot, targets: snapshot.targets.map(t => ({ ...t, armorByPart: armorByPartFromCharacterSheet(context.sheetById.get(context.placements.find(p => p.id === t.id)?.sheetId ?? "")) })) },
        map: context.map,
        healthByPlacementId,
        actorLabel: turn.label,
        targetLabel: (id) => placementLogNames.get(id) ?? id.slice(0, 8),
        targetReflexSave: (id) => {
          const sheet = context.sheetById.get(
            context.placements.find((p) => p.id === id)?.sheetId ?? "",
          );
          return { ref: refFromSheet(sheet), athletics: athleticsFromSheet(sheet) };
        },
        attackBonus,
        attackTerms: rangedAttackCheckTerms(shooterParts, suppressMalus),
        roundsSpent: spent,
        rng: damageRng,
      });
      healthByPlacementId = suppress.healthByPlacementId;
      fireDiceRolls.push(...suppress.diceRolls);
      fireLines.push(...suppress.lines);
      fireLines.push(describeSuppressiveFireAmmo(spent, snapshot.ammo.roundsInMagazine - spent));
    }
    snapshot = applyPlanStepToSnapshot(snapshot, bundle.payload, action);
    // Movement changes what the next action can see, including shots in this same slot.
    if (intel && actor) {
      const units = benchUnitsFromPlacements(
        livePlacements.map((p) =>
          p.id === turn.placementId ? { ...p, x: snapshot.position.x, y: snapshot.position.y } : p,
        ),
        context.sheetById,
      );
      intelLines.push(...applyBenchActionIntel({
        store: intel,
        map: context.map,
        actorId: turn.placementId,
        actorTeam: actor.team,
        startPos: actionStart,
        endPos: snapshot.position,
        kinds: [kind!],
        units,
        labelById: (id) => placementLogNames.get(id) ?? id.slice(0, 8),
      }));
      snapshot = { ...snapshot, intel, targets: snapshot.targets.map(target => ({ ...target,
        localization: viewLocFromProjected(readProjectedIntel(intel, actor.team, target.id, snapshot.encounter.profileId, target.position).level),
      })) };
    }
  }
  snapshot = spendInitiativeForSlot(snapshot, turn.slot);
  if (
    bundle.payload.holdingDisengage ||
    bundle.payload.movementReason?.startsWith("脱战：") ||
    parts.some((line) => line.includes("脱战："))
  ) {
    snapshot = { ...snapshot, disengaging: bundle.payload.favorableReentry ? false : true };
  } else if (bundle.payload.favorableReentry) {
    snapshot = { ...snapshot, disengaging: false };
  }

  const plansByPlacementId = {
    ...session.plansByPlacementId,
    [turn.placementId]: { snapshot, payload: bundle.payload, plan: bundle.plan },
  };

  const fsmByPlacementId = { ...(session.fsmByPlacementId ?? {}) };
  if (replanned.memory) fsmByPlacementId[turn.placementId] = replanned.memory;

  const actionDescriptions = [...parts, ...fireLines, ...intelLines];
  const label =
    actionDescriptions.length > 0
      ? `${turn.label} · ${actionDescriptions.join(" · ")}`
      : `${turn.label} · 主动段 ${turn.slot + 1}（空）`;

  const outcome = evaluateBenchCombatOutcome(context.placements, healthByPlacementId);
  const lastCompletedSlotByPlacementId = {
    ...(session.lastCompletedSlotByPlacementId ?? {}),
    [turn.placementId]: turn.slot,
  };

  const next: CombatBenchSession = {
    ...session,
    plansByPlacementId,
    fsmByPlacementId,
    intel,
    healthByPlacementId,
    combatEnded: outcome.ended,
    endReason: outcome.ended ? outcome.reason : null,
    turnIndex: session.turnIndex + 1,
    lastCompletedSlotByPlacementId,
  };

  const stepLabel =
    newCombatRound !== undefined
      ? `进入第 ${newCombatRound} 战斗轮 · ${label}`
      : label;

  return {
    session: attachBenchStepLog(next, {
      combatRound: session.combatRound,
      turnIndexBefore,
      turn,
      label: stepLabel,
      actorPlacementId: turn.placementId,
      actorPosition: snapshot.position,
      actionDescriptions,
      diceRolls: fireDiceRolls,
      enteredNewCombatRound: newCombatRound,
    }),
    label: stepLabel,
    actorPlacementId: turn.placementId,
    actorPosition: snapshot.position,
    done: outcome.ended,
    newCombatRound,
  };
}

export function shouldAdvanceCombatBenchRound(session: CombatBenchSession): boolean {
  return session.turnSequence.length > 0 && session.turnIndex >= session.turnSequence.length;
}

export function parseBenchMapViewBox(svgMarkup: string): SvgViewBox | null {
  return parseSvgViewBox(svgMarkup);
}
