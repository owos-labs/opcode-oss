"use client";

import type { InitiativeQueueEntry, InitiativeTimelineStep } from "@/lib/combat/combat-bench-initiative";

export function CombatInitiativeQueue({
  queue,
  timeline,
  timelineIndex,
  title,
  emptyLabel,
  difficultyLabel,
}: {
  queue: readonly InitiativeQueueEntry[];
  timeline: readonly InitiativeTimelineStep[];
  timelineIndex: number;
  title: string;
  emptyLabel: string;
  difficultyLabel: (id: InitiativeQueueEntry["profileId"]) => string;
}) {
  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-content3 p-4 text-sm text-foreground/60">
        {emptyLabel}
      </div>
    );
  }

  const current = timeline[timelineIndex];

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-foreground/10 bg-content3 p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{title}</h2>
      <ol className="max-h-40 space-y-1 overflow-y-auto text-sm lg:max-h-52">
        {queue.map((entry, order) => {
          const isCurrentActor =
            current &&
            (current.kind === "pass"
              ? current.placementId === entry.placementId
              : current.placementId === entry.placementId && current.kind === "decider_slot");
          return (
            <li
              key={entry.placementId}
              className={`rounded-lg border px-2 py-1.5 ${
                isCurrentActor ? "border-primary bg-primary/10" : "border-transparent bg-background/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  <span className="text-foreground/40">{order + 1}.</span> {entry.label}
                  {entry.isDecider ? (
                    <span className="ml-1 text-[10px] font-bold uppercase text-primary">AI</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-foreground/45">
                  主动 {entry.initiativePool}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-foreground/55">
                {difficultyLabel(entry.profileId)} · {entry.team}
              </p>
            </li>
          );
        })}
      </ol>
      {current ? (
        <p className="mt-2 border-t border-foreground/10 pt-2 font-mono text-[10px] text-foreground/60">
          {current.kind === "pass"
            ? `→ ${current.label} · 跳过`
            : `→ ${current.label} · 主动段 ${current.slot + 1}`}
        </p>
      ) : null}
    </div>
  );
}
