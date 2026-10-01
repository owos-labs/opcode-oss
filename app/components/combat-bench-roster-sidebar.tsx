"use client";

import type { CombatBenchUnitStatusView } from "@/lib/combat/combat-bench-unit-status";

function healthLine(view: CombatBenchUnitStatusView): string {
  const health = view.health;
  if (!health) return "—";
  if (health.mode === "simple") {
    return `${health.simpleCurrent ?? "—"} / ${health.simpleMax ?? "—"}`;
  }
  return `合计 ${health.simpleCurrent ?? "—"} / ${health.simpleMax ?? "—"}`;
}

export function CombatBenchRosterSidebar({
  units,
  onSelectPlacement,
}: {
  units: readonly CombatBenchUnitStatusView[];
  onSelectPlacement: (id: string) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-foreground/10 bg-content3 p-4 shadow-sm lg:w-72 lg:min-h-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">角色状态 · 武器</p>
      {units.length === 0 ? (
        <p className="text-sm text-foreground/55">地图上没有单位。</p>
      ) : (
        <ul className="flex max-h-[min(70vh,720px)] flex-col gap-2 overflow-y-auto text-sm">
          {units.map((view) => (
            <li key={view.placementId}>
              <button
                type="button"
                onClick={() => onSelectPlacement(view.placementId)}
                className={`w-full rounded-xl border p-2 text-left ${
                  view.isSelected ? "border-primary bg-primary/5" : "border-foreground/10 bg-background/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {view.label}
                    {view.isDecider ? (
                      <span className="ml-1 text-[10px] font-bold uppercase text-primary">AI</span>
                    ) : null}
                  </span>
                  <span className="text-[10px] text-foreground/45">{view.team}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-foreground/55">
                  {view.profileLabel} · ({view.position.x.toFixed(1)}, {view.position.y.toFixed(1)}) m
                  {view.hasLiveSnapshot ? " · 战斗中" : ""}
                </p>
                <dl className="mt-2 space-y-1 font-mono text-[10px] text-foreground/70">
                  <div className="flex justify-between gap-2">
                    <dt className="text-foreground/45">生命</dt>
                    <dd>{healthLine(view)}</dd>
                  </div>
                  {view.health?.mode === "normal" && view.health.parts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-2 text-[9px] text-foreground/55">
                      {view.health.parts.map((part) => (
                        <div key={part.key} className="flex justify-between gap-1">
                          <span>{part.label}</span>
                          <span>
                            {part.current ?? "—"}/{part.max}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-foreground/45">主动</dt>
                    <dd>
                      {view.initiativeRemaining ?? "—"} / {view.initiativeTotal ?? "—"}
                    </dd>
                  </div>
                  {view.mov !== null ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-foreground/45">移动</dt>
                      <dd>
                        已走 {(view.metersMovedThisRound ?? 0).toFixed(1)} / {view.mov} m
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-foreground/45">感知</dt>
                    <dd>
                      A {view.hearingA} · V {view.openVisionV} · S {view.passiveS} m
                    </dd>
                  </div>
                  {view.suppressionActive ? (
                    <div className="text-amber-600 dark:text-amber-400">压制中</div>
                  ) : null}
                </dl>
                {view.weapon && view.weaponName ? (
                  <div className="mt-2 rounded-lg border border-foreground/10 bg-content3/80 p-2">
                    <p className="text-xs font-semibold">{view.weaponName}</p>
                    {view.weaponCaliber ? (
                      <p className="mt-0.5 text-[10px] text-foreground/55">{view.weaponCaliber}</p>
                    ) : null}
                    <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                      <div>
                        <dt className="text-foreground/40">射程</dt>
                        <dd>{view.weapon.rangeM} m</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/40">射速</dt>
                        <dd>{view.weapon.rateOfFire}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/40">精度</dt>
                        <dd>{view.weapon.accuracy}</dd>
                      </div>
                      <div>
                        <dt className="text-foreground/40">弹匣</dt>
                        <dd>{view.ammo?.roundsInMagazine ?? "—"}</dd>
                      </div>
                      {view.ammo ? (
                        <>
                          <div>
                            <dt className="text-foreground/40">穿深</dt>
                            <dd>{view.ammo.penetration}</dd>
                          </div>
                          <div>
                            <dt className="text-foreground/40">伤害骰</dt>
                            <dd>{view.ammo.expectedDamageDice}d</dd>
                          </div>
                        </>
                      ) : null}
                    </dl>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-foreground/50">无远程武器</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
