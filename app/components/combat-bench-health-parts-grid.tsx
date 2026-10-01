"use client";

import type { BenchHealthPartRow } from "@/lib/combat/combat-bench-health";
import { benchHealthPartIsDestroyed } from "@/lib/combat/combat-bench-health";

export function CombatBenchHealthPartsGrid({
  parts,
  dense,
}: {
  parts: readonly BenchHealthPartRow[];
  dense?: boolean;
}) {
  if (parts.length === 0) return null;
  return (
    <dl
      className={`grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-foreground/65 ${
        dense ? "text-[9px]" : "text-[10px]"
      }`}
    >
      {parts.map((part) => {
        const destroyed = benchHealthPartIsDestroyed(part);
        return (
          <div key={part.key} className="flex justify-between gap-1">
            <dt className={destroyed ? "text-danger/80" : "text-foreground/45"}>{part.label}</dt>
            <dd className={destroyed ? "font-semibold text-danger" : undefined}>
              {part.current ?? "—"}/{part.max}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
