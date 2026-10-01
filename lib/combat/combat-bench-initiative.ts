import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { mulberry32 } from "../combat-ai/planning.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { RoundPlan } from "../combat-ai/decide.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";

export type InitiativeRollEntry = {
  placementId: string;
  label: string;
  team: CombatMapPlacement["team"];
  initiativePool: number;
  profileId: NpcDifficultyId;
  isDecider: boolean;
  /** Nd10 + REF + bonuses, high to low. */
  roll: number;
  ref: number;
  initiativeBonus: number;
  d10Faces: readonly number[];
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

export function initiativeBonusFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  const ref = (sheet.stats as { stats?: { ref?: { mod?: unknown } } } | undefined)?.stats?.ref;
  const mod = Number(ref?.mod);
  return Number.isFinite(mod) ? mod : 0;
}

export function expectedInitiativeTotal(ref: number, initiativeBonus = 0): number {
  return Math.round(5.5 * initiativeD10Count(ref + initiativeBonus)) + ref + initiativeBonus;
}

export function initiativePoolFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  return expectedInitiativeTotal(refFromSheet(sheet), initiativeBonusFromSheet(sheet));
}

export function refFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  return readOpcodeSheetSummary(sheet.stats, sheet.status).baseStats.ref;
}

export function athleticsFromSheet(sheet: CharacterSheet | undefined): number {
  if (!sheet) return 0;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  return summary.skills.find((s) => s.name === "athelete")?.value ?? 0;
}

export function extraInitiativeD10Count(ref: number): number {
  let extra = 0;
  if (ref >= 8) extra++;
  if (ref >= 10) extra++;
  if (ref >= 15) extra++;
  return extra;
}

export function initiativeD10Count(ref: number): number {
  return 1 + extraInitiativeD10Count(ref);
}

export function formatInitiativeRollFormula(ref: number, initiativeBonus = 0): string {
  const parts = [`${initiativeD10Count(ref + initiativeBonus)}d10`, `REF ${ref}`];
  if (initiativeBonus) parts.push(String(initiativeBonus));
  return parts.join(" + ");
}

export function rollInitiativeDice(
  rng: () => number,
  ref: number,
  initiativeBonus = 0,
): { faces: number[]; total: number } {
  const faces = Array.from({ length: initiativeD10Count(ref + initiativeBonus) }, () => 1 + Math.floor(rng() * 10));
  const total = faces.reduce((sum, face) => sum + face, 0) + ref + initiativeBonus;
  return { faces, total };
}

export function rollInitiativeValue(rng: () => number, ref: number, initiativeBonus = 0): number {
  return rollInitiativeDice(rng, ref, initiativeBonus).total;
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
    const initiativeBonus = initiativeBonusFromSheet(sheet);
    const rolled = rollInitiativeDice(rng, ref, initiativeBonus);
    return {
      placementId: p.id,
      label: p.label,
      team: p.team,
      initiativePool: rolled.total,
      profileId: placementProfileId(p),
      isDecider: p.id === input.deciderPlacementId,
      ref,
      initiativeBonus,
      d10Faces: rolled.faces,
      roll: rolled.total,
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
