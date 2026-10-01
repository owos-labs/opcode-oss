"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { useMemo } from "react";

import { BenchControlButton } from "@/app/components/bench-control-button";
import { CombatBenchHealthPartsGrid } from "@/app/components/combat-bench-health-parts-grid";
import type { CombatBenchUnitStatusView } from "@/lib/combat/combat-bench-unit-status";
import { formatBenchHealthShort } from "@/lib/combat/combat-bench-health";
import {
  NPC_DIFFICULTY_IDS,
  NPC_DIFFICULTY_LABELS,
  type NpcDifficultyId,
} from "@/lib/combat-ai/difficulty";
import type { CombatTurnStep, InitiativeRollEntry } from "@/lib/combat/combat-bench-initiative";
import type { CombatMapPlacement } from "@/lib/combat/combat-bench-placements";
import { teamColorIndex } from "@/lib/combat/combat-bench-placements";
import {
  mergeBenchUnitBarRows,
  turnStepsForPlacement,
  type BenchUnitBarRow,
} from "@/lib/combat/combat-bench-unit-bar";
import type { OpcodeLocalSheet } from "@/lib/character-sheets/model";
import { sheetListLabel } from "@/lib/character-sheets/model";

const TEAM_BADGE = [
  "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  "bg-lime-500/15 text-lime-800 dark:text-lime-200",
] as const;

function teamBadgeClass(team: string): string {
  return TEAM_BADGE[teamColorIndex(team)] ?? TEAM_BADGE[0];
}

function WeaponHoverPanel({ view }: { view: CombatBenchUnitStatusView }) {
  if (!view.weapon || !view.weaponName) {
    return <p className="text-[10px] text-foreground/55">无远程武器</p>;
  }
  return (
    <div className="space-y-1 font-mono text-[10px] text-foreground/80">
      <p className="font-sans text-xs font-semibold text-foreground">{view.weaponName}</p>
      {view.weaponCaliber ? (
        <p className="font-sans text-[10px] text-foreground/55">{view.weaponCaliber}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span className="text-foreground/45">射程</span>
        <span>{view.weapon.rangeM} m</span>
        <span className="text-foreground/45">射速</span>
        <span>{view.weapon.rateOfFire}</span>
        <span className="text-foreground/45">精度</span>
        <span>{view.weapon.accuracy}</span>
        <span className="text-foreground/45">弹匣</span>
        <span>{view.ammo?.roundsInMagazine ?? "—"}</span>
        {view.ammo ? (
          <>
            <span className="text-foreground/45">穿深</span>
            <span>{view.ammo.penetration}</span>
            <span className="text-foreground/45">伤害骰</span>
            <span>{view.ammo.damageDiceExpr || "—"}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function UnitInitiativeCard({
  row,
  placement,
  turnSequence,
  turnIndex,
  activePlacementId,
  rosterEditable,
  deciderPlacementId,
  busy,
  t,
  onSelectPlacement,
  onSetDecider,
  onRemovePlacement,
  onSetTeam,
  onSetProfile,
  isSquadLeader,
}: {
  row: BenchUnitBarRow;
  placement: CombatMapPlacement | undefined;
  isSquadLeader: boolean;
  turnSequence: readonly CombatTurnStep[];
  turnIndex: number;
  activePlacementId: string | undefined;
  rosterEditable: boolean;
  deciderPlacementId: string | null;
  busy: boolean;
  t: (key: string) => string;
  onSelectPlacement: (id: string) => void;
  onSetDecider: (id: string) => void;
  onRemovePlacement: (id: string) => void;
  onSetTeam: (id: string, team: string) => void;
  onSetProfile: (id: string, profileId: NpcDifficultyId) => void;
}) {
  const { view, initiative, initiativeRank } = row;
  const health = view.health;
  const unitSteps = turnStepsForPlacement(turnSequence, view.placementId);
  const isActiveUnit = activePlacementId === view.placementId;

  return (
    <li className="group relative min-w-[14rem] max-w-[18rem] flex-1">
      <div
        className={`h-full rounded-xl border text-xs ${
          view.isSelected || isActiveUnit
            ? "border-primary bg-primary/10"
            : "border-foreground/10 bg-background/80"
        }`}
      >
        <div className="flex items-start gap-1 px-3 pt-2.5">
          <button
            type="button"
            onClick={() => onSelectPlacement(view.placementId)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {initiativeRank != null ? (
                <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground/60">
                  #{initiativeRank}
                </span>
              ) : null}
              <span className="truncate font-semibold text-foreground">{view.label}</span>
              <span className="font-mono text-[9px] text-foreground/40">
                ({view.position.x.toFixed(1)}, {view.position.y.toFixed(1)})
              </span>
              {view.isDecider ? (
                <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">
                  AI
                </span>
              ) : null}
              {isSquadLeader ? (
                <span className="rounded bg-amber-400/25 px-1 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-200">
                  队长
                </span>
              ) : null}
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${teamBadgeClass(view.team)}`}
              >
                {view.team}
              </span>
            </div>

            {initiative ? (
              <p className="mt-1.5 font-mono text-[10px] text-foreground/60">
                先攻 {initiative.roll}
                <span className="text-foreground/45">
                  {" "}
                  · [{initiative.d10Faces.join("+")}] + REF {initiative.ref}
                  {initiative.initiativeBonus ? ` + ${initiative.initiativeBonus}` : ""}
                </span>
              </p>
            ) : null}

            {unitSteps.length > 0 ? (
              <div className="mt-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/40">
                  行动段
                </p>
                <ol className="mt-1 flex flex-wrap gap-1">
                  {unitSteps.map(({ step, flatIndex }) => {
                    const done = flatIndex < turnIndex;
                    const active = flatIndex === turnIndex;
                    return (
                      <li
                        key={`${step.placementId}-${step.slot}-${flatIndex}`}
                        className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] ${
                          active
                            ? "border-primary bg-primary/20 text-primary"
                            : done
                              ? "border-transparent bg-foreground/10 text-foreground/35 line-through"
                              : "border-transparent bg-foreground/5 text-foreground/65"
                        }`}
                      >
                        段 {step.slot + 1}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 border-t border-foreground/10 pt-2 font-mono text-[10px] text-foreground/70">
              <div className="col-span-3 flex flex-wrap items-baseline gap-1.5">
                <dt className="text-foreground/40">{t("characterSheets.stats.hp")}</dt>
                <dd>{formatBenchHealthShort(health)}</dd>
                {health ? (
                  <span className="rounded bg-foreground/10 px-1 py-px text-[8px] font-semibold uppercase text-foreground/50">
                    {health.mode === "simple"
                      ? t("characterSheets.health.simple")
                      : t("characterSheets.health.normal")}
                  </span>
                ) : null}
              </div>
              <div>
                <dt className="text-foreground/40">主动</dt>
                <dd>
                  {view.initiativeRemaining ?? "—"}/{view.initiativeTotal ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-foreground/40">移动</dt>
                <dd>
                  {view.mov !== null
                    ? `${(view.metersMovedThisRound ?? 0).toFixed(1)}/${view.mov} m`
                    : "—"}
                </dd>
              </div>
            </dl>
            {health?.mode === "normal" && health.parts.length > 0 ? (
              <div className="mt-2 border-t border-foreground/10 pt-2">
                <CombatBenchHealthPartsGrid parts={health.parts} dense />
              </div>
            ) : null}
          </button>
        </div>

        {placement && rosterEditable ? (
          <div className="space-y-2 border-t border-foreground/10 px-3 py-2">
            <BenchControlButton
              type="button"
              className="w-full rounded-lg border border-danger/30 bg-danger/5 px-2 py-1.5 text-[11px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-40"
              disabled={busy}
              aria-label={t("combat.bench.removeUnit")}
              onClick={() => onRemovePlacement(placement.id)}
            >
              {t("combat.bench.removeUnit")}
            </BenchControlButton>
            <p className="font-mono text-[10px] text-foreground/55">
              ({placement.x.toFixed(1)}, {placement.y.toFixed(1)}) m
            </p>
            <label className="flex items-center gap-2 text-[10px] text-foreground/60">
              <input
                type="radio"
                name="decider"
                checked={deciderPlacementId === placement.id}
                onChange={() => onSetDecider(placement.id)}
              />
              决策 AI
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-foreground/45">NPC 难度</span>
              <select
                className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1 text-[11px] font-semibold"
                value={placement.profileId ?? "trained"}
                disabled={busy}
                onChange={(e) => onSetProfile(placement.id, e.target.value as NpcDifficultyId)}
              >
                {NPC_DIFFICULTY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {NPC_DIFFICULTY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-foreground/45">
                {t("combat.bench.teamLabel")}
              </span>
              <input
                className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1 text-[11px] font-semibold"
                value={placement.team}
                disabled={busy}
                onChange={(e) => onSetTeam(placement.id, e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="pb-2" />
        )}
      </div>
      <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-foreground/15 bg-content3 p-2 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <WeaponHoverPanel view={view} />
      </div>
    </li>
  );
}

export function CombatInitiativeSequenceBar({
  order,
  turnSequence,
  turnIndex,
  combatRound,
  combatEnded,
  t,
  ready,
  catalog,
  loadError,
  showImportError,
  pendingSheetId,
  setPendingSheetId,
  fileRef,
  refreshList,
  placements,
  selectedPlacementId: _selectedPlacementId,
  deciderPlacementId,
  busy,
  rosterUnits,
  onSelectPlacement,
  onSetDecider,
  onRemovePlacement,
  onSetTeam,
  onSetProfile,
  rosterEditable,
  onCopyDebugJson,
  debugCopyHint,
  copyDebugDisabled,
  squadLeaderPlacementIds,
}: {
  order: readonly InitiativeRollEntry[];
  turnSequence: readonly CombatTurnStep[];
  turnIndex: number;
  combatRound: number | null;
  combatEnded: boolean;
  rosterEditable: boolean;
  t: (key: string) => string;
  ready: boolean;
  catalog: OpcodeLocalSheet[];
  loadError: boolean;
  showImportError: boolean;
  pendingSheetId: string | null;
  setPendingSheetId: (id: string | null) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  refreshList: () => void;
  placements: CombatMapPlacement[];
  selectedPlacementId: string | null;
  deciderPlacementId: string | null;
  busy: boolean;
  rosterUnits: readonly CombatBenchUnitStatusView[];
  onSelectPlacement: (id: string) => void;
  onSetDecider: (id: string) => void;
  onRemovePlacement: (id: string) => void;
  onSetTeam: (id: string, team: string) => void;
  onSetProfile: (id: string, profileId: NpcDifficultyId) => void;
  onCopyDebugJson?: () => void;
  debugCopyHint?: string | null;
  copyDebugDisabled?: boolean;
  squadLeaderPlacementIds?: ReadonlySet<string>;
}) {
  const current = turnSequence[turnIndex];
  const hasInitiative = order.length > 0;
  const placementById = useMemo(
    () => new Map(placements.map((p) => [p.id, p])),
    [placements],
  );
  const unitRows = useMemo(
    () => mergeBenchUnitBarRows(order, rosterUnits),
    [order, rosterUnits],
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-content3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {hasInitiative && combatRound !== null
            ? `第 ${combatRound} 战斗轮（3 秒）`
            : "战斗台"}
          {combatEnded ? " · 已结束" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hasInitiative && turnSequence.length > 0 ? (
            <p className="font-mono text-[10px] text-foreground/50">
              步进 {turnIndex}/{turnSequence.length}
            </p>
          ) : null}
          {onCopyDebugJson ? (
            <>
              <BenchControlButton
                type="button"
                className="rounded-lg border border-dashed border-foreground/20 px-2 py-1 text-[10px] font-semibold text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
                disabled={copyDebugDisabled}
                onClick={onCopyDebugJson}
              >
                复制调试 JSON
              </BenchControlButton>
              {debugCopyHint ? (
                <span className="text-[10px] text-foreground/55">{debugCopyHint}</span>
              ) : null}
            </>
          ) : null}
        </div>
        {!hasInitiative && placements.length === 0 ? (
          <p className="w-full text-xs text-foreground/55">
            部署单位并开始战斗轮后显示先攻与行动段。
          </p>
        ) : null}
      </div>

      {unitRows.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
            单位 · 先攻 · 行动段
          </p>
          <ul className="flex flex-wrap gap-2">
            {unitRows.map((row) => (
              <UnitInitiativeCard
                key={row.view.placementId}
                row={row}
                placement={placementById.get(row.view.placementId)}
                turnSequence={turnSequence}
                turnIndex={turnIndex}
                activePlacementId={current?.placementId}
                rosterEditable={rosterEditable}
                deciderPlacementId={deciderPlacementId}
                busy={busy}
                t={t}
                onSelectPlacement={onSelectPlacement}
                onSetDecider={onSetDecider}
                onRemovePlacement={onRemovePlacement}
                onSetTeam={onSetTeam}
                onSetProfile={onSetProfile}
                isSquadLeader={squadLeaderPlacementIds?.has(row.view.placementId) ?? false}
              />
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-foreground/45">悬停卡片查看武器。</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-foreground/10 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {t("combat.bench.presets")}
            {ready ? ` (${catalog.length})` : ""}
          </p>
          <div className="flex gap-1">
            <BenchControlButton
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => void refreshList()}
            >
              {t("combat.bench.refresh")}
            </BenchControlButton>
            <BenchControlButton
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => fileRef.current?.click()}
            >
              {t("list.import")}
            </BenchControlButton>
          </div>
        </div>
        {!ready ? (
          <p className="text-sm text-foreground/60">…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">{t("combat.bench.sheetsError")}</p>
        ) : catalog.length === 0 ? (
          <div className="space-y-2 text-sm text-foreground/60">
            <p>{t("combat.bench.noSheets")}</p>
            <Link href="/character-sheet" className="font-semibold text-primary underline">
              {t("nav.sheets")}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {catalog.map((sheet) => {
              const selected = pendingSheetId === sheet.id;
              return (
                <li key={sheet.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", sheet.id);
                      e.dataTransfer.setData("application/x-opcode-sheet-id", sheet.id);
                      setPendingSheetId(sheet.id);
                    }}
                    onDragEnd={() => setPendingSheetId(null)}
                    onClick={() =>
                      setPendingSheetId(pendingSheetId === sheet.id ? null : sheet.id)
                    }
                    className={`cursor-grab rounded-xl border px-3 py-1.5 text-xs font-semibold active:cursor-grabbing ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-foreground/10 bg-background"
                    }`}
                  >
                    {sheetListLabel(sheet)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {showImportError ? <p className="text-xs text-danger">{t("list.importFailed")}</p> : null}
        <p className="text-xs text-foreground/50">{t("combat.bench.deployHint")}</p>
      </div>
    </div>
  );
}
