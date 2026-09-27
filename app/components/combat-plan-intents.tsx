"use client";

import type { PlanIntentRow } from "@/lib/combat/combat-plan-intent";

function timingClass(timing: PlanIntentRow["timing"]) {
  if (timing === "conditional") return "text-amber-600 dark:text-amber-400";
  if (timing === "delayed") return "text-foreground/50";
  return "text-foreground/80";
}

export function CombatPlanIntents({
  rows,
  completedDeciderSlots,
  activeInitiativeRound,
  totalUtility,
  title,
  emptyLabel,
}: {
  rows: readonly PlanIntentRow[];
  /** Decider slots fully applied (0 = none yet). */
  completedDeciderSlots: number;
  /** Next decider initiative round index from timeline, if any. */
  activeInitiativeRound: number | null;
  totalUtility?: number;
  title: string;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-content3 p-4 text-sm text-foreground/60">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-foreground/10 bg-content3 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{title}</h2>
        {totalUtility !== undefined ? (
          <span className="font-mono text-[10px] text-foreground/45">
            U={totalUtility.toFixed(2)}
          </span>
        ) : null}
      </div>
      <ol className="max-h-48 space-y-1 overflow-y-auto text-sm lg:max-h-64">
        {rows.map((row) => {
          const done = row.round < completedDeciderSlots;
          const current =
            activeInitiativeRound !== null && row.round === activeInitiativeRound && !done;
          return (
            <li
              key={row.index}
              className={`rounded-lg border px-2 py-1.5 font-mono text-xs leading-snug ${
                current
                  ? "border-primary bg-primary/10"
                  : done
                    ? "border-transparent bg-foreground/5 text-foreground/45 line-through"
                    : "border-transparent bg-transparent"
              }`}
            >
              <span className="text-foreground/40">{row.index + 1}.</span>{" "}
              <span className={timingClass(row.timing)}>{row.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
