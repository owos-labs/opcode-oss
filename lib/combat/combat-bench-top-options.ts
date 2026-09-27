import type { ScoredActionOption } from "../combat-ai/planning.ts";
import { describePlanStep } from "./combat-plan-intent.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

export type BenchTopOptionRow = {
  rank: number;
  utility: number;
  text: string;
  round: number;
  timing: ScoredActionOption["timing"];
};

export function topScoredOptionRows(
  payload: PlanningPayload,
  options: readonly ScoredActionOption[],
  topN: number,
  targetLabel?: (targetId: string | null) => string,
): BenchTopOptionRow[] {
  const sorted = [...options].sort((a, b) => b.utility - a.utility);
  const rows: BenchTopOptionRow[] = [];
  for (const opt of sorted) {
    if (rows.length >= topN) break;
    rows.push({
      rank: rows.length + 1,
      utility: opt.utility,
      round: opt.round,
      timing: opt.timing,
      text: describePlanStep(
        payload,
        {
          round: opt.round,
          kind: opt.kind,
          tile: opt.tile,
          target: opt.target,
          timing: opt.timing,
        },
        targetLabel,
      ),
    });
  }
  return rows;
}
