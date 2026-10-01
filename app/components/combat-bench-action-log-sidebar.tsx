"use client";

import type { CombatBenchActionLogEntry } from "@/lib/combat/combat-bench-action-log";
import {
  actionLogDetailBody,
  actionLogDetailKind,
  actionLogDetailKindLabel,
  expandReadableActionLogLines,
} from "@/lib/combat/combat-bench-action-log-display";

const KIND_CHIP_CLASS: Record<string, string> = {
  move: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  fire: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  damage: "bg-rose-500/15 text-rose-900 dark:text-rose-100",
  suppress: "bg-violet-500/15 text-violet-900 dark:text-violet-100",
  round: "bg-foreground/10 text-foreground/70",
  vision: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  leader: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  other: "bg-foreground/10 text-foreground/60",
};

function InitiativeRollList({
  rolls,
}: {
  rolls: CombatBenchActionLogEntry["diceRolls"];
}) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1 border-t border-foreground/10 pt-1.5">
      {rolls.map((roll, i) => (
        <li key={i} className="flex items-baseline justify-between gap-2 text-[11px] leading-snug">
          <span className="min-w-0 truncate text-foreground/70">{roll.subjectLabel}</span>
          <span className="shrink-0 font-mono text-[10px] text-foreground/80">
            [{roll.dieFaces.join("+")}]+{roll.modifier}={roll.total}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DetailLineRow({ line }: { line: string }) {
  const kind = actionLogDetailKind(line);
  const chip = KIND_CHIP_CLASS[kind] ?? KIND_CHIP_CLASS.other;
  const rows =
    kind === "fire" || kind === "damage" || kind === "suppress"
      ? expandReadableActionLogLines(line)
      : [actionLogDetailBody(line, kind)];
  return (
    <li className="flex items-start gap-2 text-[11px] leading-snug text-foreground/80">
      <span
        className={`mt-px shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${chip}`}
      >
        {actionLogDetailKindLabel(kind)}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {rows.map((row) => (
          <span key={row} className="block">
            {row}
          </span>
        ))}
      </span>
    </li>
  );
}

export function CombatBenchActionLogSidebar({
  entries,
  stepProgress,
  busy,
}: {
  entries: readonly CombatBenchActionLogEntry[];
  stepProgress: string | null;
  busy: boolean;
}) {
  return (
    <aside className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-content3 p-4 shadow-sm lg:w-full">
      {stepProgress || busy ? (
        <div className="shrink-0 flex flex-col gap-2 border-b border-foreground/10 pb-3">
          {stepProgress ? (
            <p className="text-center font-mono text-[10px] text-foreground/45">{stepProgress}</p>
          ) : null}
          {busy ? (
            <p className="text-center text-[10px] text-foreground/45">解算中…</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-3">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-foreground/50">
          行动日志
        </p>
        {entries.length === 0 ? (
          <p className="text-sm text-foreground/55">
            开始战斗轮后，先攻与各步行动会记录在此。
          </p>
        ) : (
          <ol className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1 text-sm scrollbar-subtle">
          {entries.map((entry) => (
            <li
              key={entry.logIndex}
              className="min-w-0 rounded-lg border border-foreground/10 bg-background/60 px-2 py-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/40">
                  {entry.category === "initiative"
                    ? "先攻"
                    : entry.combatRound != null
                      ? `R${entry.combatRound}`
                      : "系统"}
                </span>
                <span className="font-mono text-[9px] text-foreground/30">#{entry.logIndex}</span>
              </div>
              {entry.category === "initiative" ? null : (
                <p className="break-words text-xs font-semibold leading-snug text-foreground/90">
                  {entry.summary}
                </p>
              )}
              {entry.detailLines.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1 border-t border-foreground/10 pt-1.5">
                  {entry.detailLines.map((line, i) => (
                    <DetailLineRow key={`${entry.logIndex}-${i}`} line={line} />
                  ))}
                </ul>
              ) : null}
              {entry.diceRolls.length > 0 ? (
                <InitiativeRollList rolls={entry.diceRolls} />
              ) : null}
            </li>
          ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
