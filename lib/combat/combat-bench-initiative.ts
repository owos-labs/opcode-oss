import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { mulberry32 } from "../combat-ai/planning.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import { estimateInitiativePool } from "./character-sheet-snapshot.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";

export type InitiativeRollEntry = {
  placementId: string;
  label: string;
  team: CombatMapPlacement["team"];
  initiativePool: number;
  profileId: NpcDifficultyId;
  isDecider: boolean;
  /** REF + 1d6 bench roll for turn order. */
  roll: number;
  ref: number;
};

export type CombatTurnStep = {
  placementId: string;
  label: string;
  slot: number;
  isDecider: boolean;
};

/** @deprecated use InitiativeRollEntry */
export type InitiativeQueueEntry = InitiativeRollEntry;

/** @deprecated use CombatTurnStep */
export type InitiativeTimelineStep = CombatTurnStep & { kind?: never };

export function initiativePoolFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const marksmanship = summary.skills.find((s) => s.name === "marksmanship")?.value ?? 0;
  return estimateInitiativePool({
    ref: summary.baseStats.ref,
    wil: summary.baseStats.wil,
    marksmanship,
  });
}

export function refFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  return readOpcodeSheetSummary(sheet.stats, sheet.status).baseStats.ref;
}

/** ponytail: FSM owns exact initiative order; bench uses REF + 1d6 with seeded rng. */
export function rollInitiativeValue(rng: () => number, ref: number): number {
  const d6 = 1 + Math.floor(rng() * 6);
  return ref + d6;
}

export function placementProfileId(p: CombatMapPlacement): NpcDifficultyId {
  return p.profileId ?? "trained";
}

export function rollInitiativeOrder(input: {
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  deciderPlacementId: string;
  randomSeed: number;
}): InitiativeRollEntry[] {
  const rng = mulberry32(input.randomSeed);
  const entries = input.placements.map((p) => {
    const sheet = input.sheetById.get(p.sheetId);
    const ref = refFromSheet(sheet);
    return {
      placementId: p.id,
      label: p.label,
      team: p.team,
      initiativePool: initiativePoolFromSheet(sheet),
      profileId: placementProfileId(p),
      isDecider: p.id === input.deciderPlacementId,
      ref,
      roll: rollInitiativeValue(rng, ref),
    };
  });
  return entries.sort(
    (a, b) => b.roll - a.roll || b.initiativePool - a.initiativePool || a.label.localeCompare(b.label),
  );
}

export function maxPlanInitiativeSlot(plan: RoundPlan): number {
  if (plan.actions.length === 0) return -1;
  return Math.max(...plan.actions.map((a) => a.round));
}

/**
 * Flat turn list: for each initiative segment (slot), walk the rolled order once;
 * each step executes that unit's plan actions in that slot.
 */
export function buildCombatTurnSequence(
  order: readonly InitiativeRollEntry[],
  maxSlotByPlacementId: Readonly<Record<string, number>>,
): CombatTurnStep[] {
  let maxSlot = -1;
  for (const entry of order) {
    const slot = maxSlotByPlacementId[entry.placementId] ?? -1;
    if (slot > maxSlot) maxSlot = slot;
  }
  if (maxSlot < 0) return [];

  const steps: CombatTurnStep[] = [];
  for (let slot = 0; slot <= maxSlot; slot++) {
    for (const entry of order) {
      if ((maxSlotByPlacementId[entry.placementId] ?? -1) < slot) continue;
      steps.push({
        placementId: entry.placementId,
        label: entry.label,
        slot,
        isDecider: entry.isDecider,
      });
    }
  }
  return steps;
}

/** @deprecated use rollInitiativeOrder */
export function buildInitiativeQueue(input: {
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  deciderPlacementId: string;
}): InitiativeRollEntry[] {
  return rollInitiativeOrder({ ...input, randomSeed: 42 });
}

/** @deprecated use buildCombatTurnSequence */
export function buildInitiativeTimeline(
  queue: readonly InitiativeRollEntry[],
  _deciderPlacementId: string,
  plan: RoundPlan,
): CombatTurnStep[] {
  const maxSlot = maxPlanInitiativeSlot(plan);
  const maxById = Object.fromEntries(queue.map((e) => [e.placementId, maxSlot]));
  return buildCombatTurnSequence(queue, maxById);
}

export function maxDeciderInitiativeSlot(plan: RoundPlan): number {
  return maxPlanInitiativeSlot(plan);
}
