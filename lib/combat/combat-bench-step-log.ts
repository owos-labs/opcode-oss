import type { BenchPlacementHealthState } from "./combat-bench-outcome.ts";
import type { CombatTurnStep } from "./combat-bench-initiative.ts";

export type BenchDiceRollRecord = {
  subjectLabel: string;
  formula: string;
  dieFaces: readonly number[];
  modifier: number;
  total: number;
};

export type CombatBenchStepLogEntry = {
  stepIndex: number;
  combatRound: number;
  turnIndexBefore: number;
  turn: CombatTurnStep | null;
  label: string;
  actorPlacementId: string;
  actorPosition: { x: number; y: number };
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  actionDescriptions: readonly string[];
  diceRolls?: readonly BenchDiceRollRecord[];
  /** Set when this step crossed into a new 3s combat round. */
  enteredNewCombatRound?: number;
};

export function groupStepLogByCombatRound(
  stepLog: readonly CombatBenchStepLogEntry[],
): Record<number, CombatBenchStepLogEntry[]> {
  const out: Record<number, CombatBenchStepLogEntry[]> = {};
  for (const entry of stepLog) {
    (out[entry.combatRound] ??= []).push(entry);
  }
  return out;
}

export function appendCombatBenchStepLog(
  stepLog: readonly CombatBenchStepLogEntry[],
  entry: Omit<CombatBenchStepLogEntry, "stepIndex">,
): CombatBenchStepLogEntry[] {
  return [...stepLog, { ...entry, stepIndex: stepLog.length }];
}
