"use client";

import { NPC_DIFFICULTY_LABELS } from "@/lib/combat-ai/difficulty";
import type { CombatTurnStep, InitiativeRollEntry } from "@/lib/combat/combat-bench-initiative";

export function CombatInitiativeSequenceBar({
  order,
  turnSequence,
  turnIndex,
  combatRound,
  combatEnded,
}: {
  order: readonly InitiativeRollEntry[];
  turnSequence: readonly CombatTurnStep[];
  turnIndex: number;
  combatRound: number | null;
  combatEnded: boolean;
}) {
  const current = turnSequence[turnIndex];

  if (order.length === 0) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-content3 px-4 py-3 text-sm text-foreground/55">
        部署单位并开始战斗轮后，此处显示主动性掷骰顺序与行动序列。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-content3 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {combatRound !== null ? `第 ${combatRound} 战斗轮（3 秒）` : "战斗"}
          {combatEnded ? " · 已结束" : ""}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">主动性掷骰（REF+1d6）</p>
        <ol className="flex flex-wrap gap-2">
          {order.map((entry, i) => (
            <li
              key={entry.placementId}
              className={`rounded-xl border px-3 py-1.5 text-xs ${
                current?.placementId === entry.placementId
                  ? "border-primary bg-primary/10"
                  : "border-foreground/10 bg-background/80"
              }`}
            >
              <span className="font-semibold">
                {i + 1}. {entry.label}
              </span>
              <span className="ml-2 font-mono text-foreground/55">
                {entry.roll}（REF {entry.ref}）
              </span>
              {entry.isDecider ? (
                <span className="ml-1 font-bold text-primary">AI</span>
              ) : null}
              <span className="ml-2 text-foreground/45">{NPC_DIFFICULTY_LABELS[entry.profileId]}</span>
            </li>
          ))}
        </ol>
      </div>
      {turnSequence.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
            行动序列（步进 {turnIndex}/{turnSequence.length}）
          </p>
          <ol className="flex gap-1 overflow-x-auto pb-1 font-mono text-[10px]">
            {turnSequence.map((step, i) => {
              const done = i < turnIndex;
              const active = i === turnIndex;
              return (
                <li
                  key={`${step.placementId}-${step.slot}-${i}`}
                  className={`shrink-0 rounded-lg border px-2 py-1 ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : done
                        ? "border-transparent bg-foreground/10 text-foreground/40 line-through"
                        : "border-transparent bg-foreground/5 text-foreground/70"
                  }`}
                  title={`${step.label} · 主动段 ${step.slot + 1}`}
                >
                  {step.label.slice(0, 6)}·{step.slot + 1}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
