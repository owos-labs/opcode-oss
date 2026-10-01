import {
  compactActionLogDetailLines,
  compactActionLogStepSummary,
} from "./combat-bench-action-log-compact.ts";
import type { InitiativeRollEntry } from "./combat-bench-initiative.ts";
import { formatInitiativeRollFormula } from "./combat-bench-initiative.ts";
import type { CombatBenchSession } from "./combat-bench.ts";
import type {
  BenchDiceRollRecord,
  CombatBenchStepLogEntry,
} from "./combat-bench-step-log.ts";

export type { BenchDiceRollRecord } from "./combat-bench-step-log.ts";

export type CombatBenchActionLogEntry = {
  logIndex: number;
  combatRound: number | null;
  category: "initiative" | "step" | "system";
  summary: string;
  detailLines: readonly string[];
  diceRolls: readonly BenchDiceRollRecord[];
  stepIndex?: number;
};

export function initiativeDiceRolls(order: readonly InitiativeRollEntry[]): BenchDiceRollRecord[] {
  return order.map((entry) => ({
    subjectLabel: entry.label,
    formula: formatInitiativeRollFormula(entry.ref, entry.initiativeBonus),
    dieFaces: [...entry.d10Faces],
    modifier: entry.ref + entry.initiativeBonus,
    total: entry.roll,
  }));
}

function initiativeDetailLine(entry: InitiativeRollEntry): string {
  const dice = entry.d10Faces.join("+");
  const mod = entry.ref + entry.initiativeBonus;
  return mod > 0 ? `${entry.label} ${dice}+${mod}=${entry.roll}` : `${entry.label} ${dice}=${entry.roll}`;
}

function initiativeLogEntry(order: readonly InitiativeRollEntry[]): CombatBenchActionLogEntry {
  return {
    logIndex: 0,
    combatRound: null,
    category: "initiative",
    summary: "先攻",
    detailLines: order.map(initiativeDetailLine),
    diceRolls: initiativeDiceRolls(order),
  };
}

function stepLogEntry(entry: CombatBenchStepLogEntry): CombatBenchActionLogEntry {
  const rawDetails =
    entry.actionDescriptions.length > 0
      ? [...entry.actionDescriptions]
      : entry.enteredNewCombatRound
        ? [`进入第 ${entry.enteredNewCombatRound} 战斗轮（3 秒）`]
        : [];
  const detailLines = compactActionLogDetailLines(rawDetails);
  return {
    logIndex: entry.stepIndex + 1,
    combatRound: entry.combatRound,
    category: "step",
    summary: compactActionLogStepSummary({
      label: entry.label,
      turn: entry.turn,
      enteredNewCombatRound: entry.enteredNewCombatRound,
    }),
    detailLines,
    diceRolls: entry.diceRolls ?? [],
    stepIndex: entry.stepIndex,
  };
}

/** Chronological bench log: initiative once, then every step with dice when present. */
export function buildCombatBenchActionLog(
  session: CombatBenchSession | null,
): CombatBenchActionLogEntry[] {
  if (!session) return [];
  const out: CombatBenchActionLogEntry[] = [initiativeLogEntry(session.initiativeOrder)];
  for (const step of session.stepLog) {
    out.push(stepLogEntry(step));
  }
  return out.map((row, logIndex) => ({ ...row, logIndex }));
}
