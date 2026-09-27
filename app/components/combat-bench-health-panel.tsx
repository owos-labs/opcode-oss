"use client";

import type { BenchHealthView } from "@/lib/combat/combat-bench-health";

export function CombatBenchHealthPanel({
  views,
  scope,
  onScopeChange,
  selectedId,
  onSelectId,
}: {
  views: readonly { placementId: string; health: BenchHealthView }[];
  scope: "all" | "selected";
  onScopeChange: (scope: "all" | "selected") => void;
  selectedId: string | null;
  onSelectId: (id: string) => void;
}) {
  const shown =
    scope === "selected" && selectedId
      ? views.filter((v) => v.placementId === selectedId)
      : views;

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-foreground/10 bg-content3 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">生命值</h2>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            className={`rounded-lg px-2 py-0.5 font-semibold ${scope === "all" ? "bg-primary/15 text-primary" : "text-foreground/55"}`}
            onClick={() => onScopeChange("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={`rounded-lg px-2 py-0.5 font-semibold ${scope === "selected" ? "bg-primary/15 text-primary" : "text-foreground/55"}`}
            onClick={() => onScopeChange("selected")}
          >
            选中
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-foreground/55">暂无单位或未选中。</p>
      ) : (
        <ul className="max-h-56 space-y-3 overflow-y-auto text-sm">
          {shown.map(({ placementId, health }) => (
            <li
              key={placementId}
              className={`rounded-lg border p-2 ${
                selectedId === placementId ? "border-primary/40 bg-primary/5" : "border-foreground/10"
              }`}
            >
              <button
                type="button"
                className="w-full text-left font-semibold"
                onClick={() => onSelectId(placementId)}
              >
                {health.label}
                {health.mode === "simple" ? (
                  <span className="ml-2 font-mono text-xs font-normal text-foreground/60">
                    {health.simpleCurrent ?? "—"} / {health.simpleMax ?? "—"}
                  </span>
                ) : (
                  <span className="ml-2 font-mono text-xs font-normal text-foreground/60">
                    合计 {health.simpleCurrent ?? "—"} / {health.simpleMax ?? "—"}
                  </span>
                )}
              </button>
              {health.mode === "normal" && health.parts.length > 0 ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-foreground/65">
                  {health.parts.map((part) => (
                    <div key={part.key} className="flex justify-between gap-1">
                      <dt>{part.label}</dt>
                      <dd>
                        {part.current ?? "—"}/{part.max}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
