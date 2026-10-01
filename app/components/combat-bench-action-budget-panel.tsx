"use client";

import { Card } from "@/app/components/card";
import type { CombatBenchActionBudgetView } from "@/lib/combat/combat-bench-action-budget";

const ROUND_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
] as const;

export function CombatBenchActionBudgetPanel({
  label,
  budget,
}: {
  label: string;
  budget: CombatBenchActionBudgetView | null;
}) {
  if (!budget) {
    return (
      <Card radius="xl" padding="md" className="text-sm text-foreground/55">
        选中单位并开始战斗轮后，显示主动性 / 移动预算在本轮计划中的分配。
      </Card>
    );
  }

  const initPct = (n: number) =>
    budget.initiativeAtPlanStart > 0
      ? Math.min(100, (n / budget.initiativeAtPlanStart) * 100)
      : 0;
  const movPct = (n: number) =>
    budget.movRoundMax > 0 ? Math.min(100, (n / budget.movRoundMax) * 100) : 0;

  return (
    <Card radius="xl" padding="md" className="text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
        行动预算 · {label}
      </h2>

      <div className="mt-3 space-y-1">
        <div className="flex justify-between font-mono text-[10px] text-foreground/55">
          <span>主动性（计划占用）</span>
          <span>
            −{budget.initiativePlannedSpend} → 余 {budget.initiativeAfterPlan} /{" "}
            {budget.initiativeAtPlanStart}
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-foreground/10">
          {budget.rounds.map((r, i) => (
            <div
              key={r.round}
              className={`${ROUND_COLORS[i % ROUND_COLORS.length] ?? "bg-primary"} h-full`}
              style={{ width: `${initPct(r.slotCost)}%` }}
              title={`主动段 ${r.round + 1}：−${r.slotCost}（${r.actionCount} 动作）`}
            />
          ))}
          <div
            className="h-full bg-foreground/5"
            style={{ width: `${initPct(budget.initiativeAfterPlan)}%` }}
            title="计划后剩余"
          />
        </div>
        <ul className="space-y-0.5 font-mono text-[10px] text-foreground/65">
          {budget.rounds.map((r, i) => (
            <li key={r.round}>
              <span className={`inline-block size-2 rounded-sm ${ROUND_COLORS[i % ROUND_COLORS.length]}`} />{" "}
              段 {r.round + 1} −{r.slotCost} · {r.actionCount} 动作（{r.kinds.join(", ")}）→ 池{" "}
              {r.initiativeRemainingAfter}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex justify-between font-mono text-[10px] text-foreground/55">
          <span>移动（本回合）</span>
          <span>
            计划 {budget.movPlannedSpend.toFixed(1)} m · 余 {budget.movAfterPlan.toFixed(1)} /{" "}
            {budget.movAtPlanStart.toFixed(1)} m（上限 {budget.movRoundMax.toFixed(1)} m）
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-emerald-500/80"
            style={{ width: `${movPct(budget.movPlannedSpend)}%` }}
          />
          <div
            className="h-full bg-foreground/5"
            style={{ width: `${movPct(budget.movAfterPlan)}%` }}
          />
        </div>
        {budget.moveLegs.length > 0 ? (
          <ul className="space-y-0.5 font-mono text-[10px] text-foreground/65">
            {budget.moveLegs.map((leg, i) => (
              <li key={`${leg.planIndex}-${i}`}>
                段 {leg.round + 1} move {leg.meters.toFixed(1)} m → (
                {leg.to.x.toFixed(1)}, {leg.to.y.toFixed(1)}) · 累计 {leg.metersAfterLeg.toFixed(1)}{" "}
                m · 余 {leg.movRemainingAfterLeg.toFixed(1)} m
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-foreground/45">计划中无移动动作。</p>
        )}
      </div>
    </Card>
  );
}
