"use client";

import { planGroupedByInitiativeRound } from "@/lib/combat/combat-plan-intent";
import type { PlacementBenchPlan } from "@/lib/combat/combat-bench";

export function CombatBenchInitiativePlans({
  units,
  activePlacementId,
  activeRound,
}: {
  units: readonly {
    placementId: string;
    label: string;
    isAi: boolean;
    plan: PlacementBenchPlan | null;
    targetLabel: (id: string | null) => string;
  }[];
  activePlacementId: string | null;
  activeRound: number | null;
}) {
  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-content3 p-4 text-sm text-foreground/55">
        开始战斗轮后显示各单位主动性规划（按主动段分组）。
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-foreground/10 bg-content3 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">主动性规划</h2>
      <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">
        {units.map((unit) => {
          const groups =
            unit.plan &&
            planGroupedByInitiativeRound(unit.plan.payload, unit.plan.plan, unit.targetLabel);
          const isActiveUnit = unit.placementId === activePlacementId;
          return (
            <li
              key={unit.placementId}
              className={`rounded-xl border p-2 ${
                isActiveUnit ? "border-primary/50 bg-primary/5" : "border-foreground/10"
              }`}
            >
              <p className="font-semibold">
                {unit.label}
                {unit.isAi ? <span className="ml-1 text-[10px] font-bold text-primary">AI</span> : null}
                {unit.plan ? (
                  <span className="ml-2 font-mono text-[10px] font-normal text-foreground/50">
                    {unit.plan.payload.shape.initiativeRounds} 主动段 · 池{" "}
                    {unit.plan.snapshot.initiativeRemaining}/{unit.plan.snapshot.initiativeTotal}
                  </span>
                ) : null}
              </p>
              {!groups || groups.length === 0 ? (
                <p className="mt-1 text-xs text-foreground/50">无计划或缺少远程武器</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {groups.map((group) => (
                    <div key={group.round}>
                      <p
                        className={`text-[10px] font-bold uppercase ${
                          isActiveUnit && activeRound === group.round
                            ? "text-primary"
                            : "text-foreground/45"
                        }`}
                      >
                        主动段 {group.round + 1}
                      </p>
                      <ul className="mt-0.5 space-y-0.5 font-mono text-[10px] text-foreground/75">
                        {group.rows.map((row) => (
                          <li key={row.index}>{row.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
