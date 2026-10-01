"use client";

import { Card } from "@/app/components/card";
import type { BenchTopOptionRow } from "@/lib/combat/combat-bench-top-options";

export function CombatBenchTopOptions({
  units,
  emptyHint,
}: {
  units: readonly {
    placementId: string;
    label: string;
    isAi: boolean;
    rows: readonly BenchTopOptionRow[];
  }[];
  emptyHint: string;
}) {
  if (units.length === 0) {
    return (
      <Card radius="xl" padding="md" className="text-sm text-foreground/60">
        {emptyHint}
      </Card>
    );
  }

  return (
    <Card radius="xl" padding="md" className="min-h-0">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
        Top 选项（按效用）
      </h2>
      <ul className="max-h-64 space-y-3 overflow-y-auto text-sm lg:max-h-80">
        {units.map((unit) => (
          <li key={unit.placementId}>
            <Card radius="md" padding="sm" spotlight={false} className="!border-foreground/10">
            <p className="font-semibold">
              {unit.label}
              {unit.isAi ? (
                <span className="ml-1 text-[10px] font-bold uppercase text-primary">AI</span>
              ) : null}
            </p>
            {unit.rows.length === 0 ? (
              <p className="mt-1 text-xs text-foreground/50">无可行选项</p>
            ) : (
              <ol className="mt-1 space-y-0.5 font-mono text-[10px] leading-snug">
                {unit.rows.map((row) => (
                  <li key={row.rank} className="text-foreground/75">
                    <span className="text-foreground/40">{row.rank}.</span> U={row.utility.toFixed(2)}{" "}
                    {row.text}
                  </li>
                ))}
              </ol>
            )}
            </Card>
          </li>
        ))}
      </ul>
    </Card>
  );
}
