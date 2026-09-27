"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { BenchControlButton } from "@/app/components/bench-control-button";
import { CombatBenchActionBudgetPanel } from "@/app/components/combat-bench-action-budget-panel";
import { CombatBenchMap } from "@/app/components/combat-bench-map";
import { CombatBenchInitiativePlans } from "@/app/components/combat-bench-initiative-plans";
import { CombatBenchRosterSidebar } from "@/app/components/combat-bench-roster-sidebar";
import { CombatBenchTopOptions } from "@/app/components/combat-bench-top-options";
import { CombatInitiativeSequenceBar } from "@/app/components/combat-initiative-sequence-bar";
import { CombatPlanIntents } from "@/app/components/combat-plan-intents";
import type { CompiledCombatMap } from "@/lib/combat/map-adapter/compile";
import { useT } from "@/lib/character-sheets/i18n";
import {
  NPC_DIFFICULTY_IDS,
  NPC_DIFFICULTY_LABELS,
  type NpcDifficultyId,
} from "@/lib/combat-ai/difficulty";
import { benchUnitStatusViews } from "@/lib/combat/combat-bench-unit-status";
import { parseImportedSheet, sheetListLabel } from "@/lib/character-sheets/model";
import {
  mergeSheetsById,
  readCombatBenchSheetCache,
  upsertCombatBenchSheetCache,
} from "@/lib/character-sheets/sheet-catalog";
import { opfsAvailable, writeSheet } from "@/lib/character-sheets/storage";
import type { CombatBenchSession } from "@/lib/combat/combat-bench";
import {
  benchStartValidation,
  defaultDeciderPlacementId,
  type CombatMapPlacement,
} from "@/lib/combat/combat-bench-placements";
import { planIntentRows } from "@/lib/combat/combat-plan-intent";
import { buildCombatBenchActionBudgetView } from "@/lib/combat/combat-bench-action-budget";
import {
  buildCombatBenchMapOverlay,
  DEFAULT_BENCH_VISION_RANGE_M,
} from "@/lib/combat/combat-bench-map-overlay";
import {
  buildCombatBenchRoundDebugJson,
  serializeCombatBenchRoundDebug,
} from "@/lib/combat/combat-bench-debug-export";
import { COMBAT_TEST_MAP_SVG_PATH } from "@/lib/combat/combat-test-scene";

export function CombatBenchWorkbench() {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const { ready, loadError, sheets, refreshList, importText, importError } = useSheetApp();
  const [cacheTick, setCacheTick] = useState(0);
  const [pendingSheetId, setPendingSheetId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<CombatMapPlacement[]>([]);
  const [deciderPlacementId, setDeciderPlacementId] = useState<string | null>(null);
  const [session, setSession] = useState<CombatBenchSession | null>(null);
  const [lastStepLabel, setLastStepLabel] = useState<string | null>(null);
  const [mapSvg, setMapSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importLocalError, setImportLocalError] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [benchMap, setBenchMap] = useState<CompiledCombatMap | null>(null);
  const [debugCopyHint, setDebugCopyHint] = useState<string | null>(null);

  useEffect(() => {
    void fetch(COMBAT_TEST_MAP_SVG_PATH)
      .then((r) => r.text())
      .then(setMapSvg)
      .catch(() => setMapSvg(null));
  }, []);

  useEffect(() => {
    if (!mapSvg) return;
    let cancelled = false;
    void (async () => {
      const [{ compileOpcodeMap }, { combatTestPlaceholderDocument }] = await Promise.all([
        import("@/lib/combat/map-adapter/compile-opcode-map"),
        import("@/lib/combat/combat-test-scene"),
      ]);
      const map = compileOpcodeMap(combatTestPlaceholderDocument(mapSvg));
      if (!cancelled) setBenchMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapSvg]);

  const catalog = useMemo(() => {
    void cacheTick;
    return mergeSheetsById(sheets, readCombatBenchSheetCache());
  }, [sheets, cacheTick]);

  const sheetById = useMemo(() => new Map(catalog.map((s) => [s.id, s])), [catalog]);

  const validation = benchStartValidation(placements, deciderPlacementId);

  const placeSheet = useCallback(
    (sheetId: string, x: number, y: number) => {
      const sheet = sheetById.get(sheetId);
      if (!sheet) {
        setLastStepLabel(t("combat.bench.placeFailed"));
        return;
      }
      const team = placements.length % 2 === 0 ? "hostile" : "friendly";
      const placement: CombatMapPlacement = {
        id: crypto.randomUUID(),
        sheetId,
        label: sheetListLabel(sheet),
        x,
        y,
        team,
        profileId: "trained",
      };
      setPlacements((prev) => [...prev, placement]);
      setDeciderPlacementId((prev) => prev ?? defaultDeciderPlacementId([...placements, placement]));
      setSelectedPlacementId((prev) => prev ?? placement.id);
      setSession(null);
      setLastStepLabel(null);
      setPendingSheetId(null);
    },
    [placements, sheetById, t],
  );

  async function importCharacterFile(text: string) {
    setImportLocalError(false);
    const saved = await importText(text);
    if (saved) {
      setCacheTick((n) => n + 1);
      return;
    }
    const parsed = parseImportedSheet(text);
    if (!parsed) {
      setImportLocalError(true);
      return;
    }
    parsed.id = crypto.randomUUID();
    parsed.updated_at = new Date().toISOString();
    parsed.created_at = parsed.updated_at;
    if (await opfsAvailable()) {
      try {
        await writeSheet(parsed);
        await refreshList();
      } catch {
        // still keep combat cache
      }
    }
    upsertCombatBenchSheetCache(parsed);
    setCacheTick((n) => n + 1);
  }

  function setPlacementProfile(id: string, profileId: NpcDifficultyId) {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, profileId } : p)));
    setSession(null);
    setLastStepLabel(null);
  }

  function toggleTeam(id: string) {
    setPlacements((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, team: p.team === "hostile" ? "friendly" : "hostile" }
          : p,
      ),
    );
    setSession(null);
  }

  function removePlacement(id: string) {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setDeciderPlacementId((prev) => (prev === id ? null : prev));
    setSession(null);
  }

  async function startRound() {
    if (!validation.ok || !deciderPlacementId || !mapSvg || busy) return;
    setBusy(true);
    try {
      const [{ startCombatBenchSession }, { compileOpcodeMap }, { combatTestPlaceholderDocument }] =
        await Promise.all([
          import("@/lib/combat/combat-bench"),
          import("@/lib/combat/map-adapter/compile-opcode-map"),
          import("@/lib/combat/combat-test-scene"),
        ]);
      const map = compileOpcodeMap(combatTestPlaceholderDocument(mapSvg));
      const next = startCombatBenchSession({
        map,
        deciderPlacementId,
        placements,
        sheetById,
      });
      setBenchMap(map);
      setSession(next);
      setLastStepLabel(
        next.combatEnded
          ? "战斗已开始但一方已无可战单位。"
          : `战斗开始 · 第 ${next.combatRound} 战斗轮 · 本段 ${next.turnSequence.length} 步`,
      );
    } catch {
      setLastStepLabel(t("combat.bench.startFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function step() {
    if (!session || !benchMap || busy) return;
    setBusy(true);
    try {
      const { stepCombatBenchSession, placementPositionsFromSession } = await import(
        "@/lib/combat/combat-bench"
      );
      const result = stepCombatBenchSession(session, {
        map: benchMap,
        placements,
        sheetById,
      });
      setSession(result.session);
      setLastStepLabel(result.label);
      const positions = placementPositionsFromSession(result.session);
      setPlacements((prev) =>
        prev.map((p) => {
          const pos = positions[p.id];
          return pos ? { ...p, x: pos.x, y: pos.y } : p;
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  function resetBench() {
    setSession(null);
    setLastStepLabel(null);
  }

  const stepProgress = session ? `${session.turnIndex}/${session.turnSequence.length}` : null;

  const currentTurn = session?.turnSequence[session.turnIndex];

  const activeInitiativeRound = currentTurn?.slot ?? null;

  const completedSlotsForCurrentActor = useMemo(() => {
    if (!session || !currentTurn) return 0;
    let done = 0;
    for (let i = 0; i < session.turnIndex; i++) {
      const t = session.turnSequence[i]!;
      if (t.placementId === currentTurn.placementId) done = Math.max(done, t.slot + 1);
    }
    return done;
  }, [session, currentTurn]);

  const placementLabelById = useMemo(
    () => new Map(placements.map((p) => [p.id, p.label])),
    [placements],
  );

  async function copyRoundDebugJson() {
    if (!session) return;
    const json = buildCombatBenchRoundDebugJson({
      session,
      placements,
      placementLabelById,
    });
    const text = serializeCombatBenchRoundDebug(json);
    try {
      await navigator.clipboard.writeText(text);
      setDebugCopyHint("已复制到剪贴板");
    } catch {
      setDebugCopyHint("复制失败");
    }
    window.setTimeout(() => setDebugCopyHint(null), 2500);
  }

  const intentRows = useMemo(() => {
    if (!session) return [];
    const turn = session.turnSequence[session.turnIndex];
    const planBundle = turn
      ? session.plansByPlacementId[turn.placementId]
      : session.plansByPlacementId[session.deciderPlacementId];
    if (!planBundle) return [];
    return planIntentRows(planBundle.payload, planBundle.plan, (targetId) =>
      targetId ? (placementLabelById.get(targetId) ?? targetId.slice(0, 8)) : "",
    );
  }, [session, placementLabelById]);

  const intentUtility = useMemo(() => {
    if (!session) return undefined;
    const turn = session.turnSequence[session.turnIndex];
    const planBundle = turn
      ? session.plansByPlacementId[turn.placementId]
      : session.plansByPlacementId[session.deciderPlacementId];
    return planBundle?.plan.totalUtility;
  }, [session]);

  const rosterUnits = useMemo(
    () =>
      benchUnitStatusViews({
        placements,
        sheetById,
        session,
        deciderPlacementId,
        selectedPlacementId,
      }),
    [placements, sheetById, session, deciderPlacementId, selectedPlacementId],
  );

  const selectedPlanBundle = useMemo(() => {
    if (!session || !selectedPlacementId) return null;
    return session.plansByPlacementId[selectedPlacementId] ?? null;
  }, [session, selectedPlacementId]);

  const selectedActionBudget = useMemo(() => {
    if (!selectedPlanBundle) return null;
    return buildCombatBenchActionBudgetView(selectedPlanBundle);
  }, [selectedPlanBundle]);

  const selectedPlacementLabel =
    placements.find((p) => p.id === selectedPlacementId)?.label ?? "—";

  const selectedMapOverlay = useMemo(() => {
    if (!benchMap || !selectedPlacementId) return null;
    const unit = rosterUnits.find((u) => u.placementId === selectedPlacementId);
    if (!unit || unit.mov === null) return null;
    return buildCombatBenchMapOverlay({
      map: benchMap,
      origin: unit.position,
      mov: unit.mov,
      metersMovedThisRound: unit.metersMovedThisRound ?? 0,
      visionRangeM: unit.weapon?.rangeM ?? DEFAULT_BENCH_VISION_RANGE_M,
    });
  }, [benchMap, selectedPlacementId, rosterUnits]);

  const topOptionUnits = useMemo(() => {
    if (!session) return [];
    return placements.map((p) => ({
      placementId: p.id,
      label: p.label,
      isAi: p.id === session.deciderPlacementId,
      rows: session.topOptionsByPlacementId[p.id] ?? [],
    }));
  }, [session, placements]);

  const initiativePlanUnits = useMemo(() => {
    if (!session) return [];
    return placements.map((p) => ({
      placementId: p.id,
      label: p.label,
      isAi: p.id === session.deciderPlacementId,
      plan: session.plansByPlacementId[p.id] ?? null,
      targetLabel: (targetId: string | null) =>
        targetId ? (placementLabelById.get(targetId) ?? targetId.slice(0, 8)) : "",
    }));
  }, [session, placements, placementLabelById]);

  const showImportError = importError || importLocalError;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CombatInitiativeSequenceBar
        order={session?.initiativeOrder ?? []}
        turnSequence={session?.turnSequence ?? []}
        turnIndex={session?.turnIndex ?? 0}
        combatRound={session?.combatRound ?? null}
        combatEnded={session?.combatEnded ?? false}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-foreground/10 bg-content3 p-4 shadow-sm lg:w-72 lg:min-h-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {t("combat.bench.presets")}
            {ready ? ` (${catalog.length})` : ""}
          </p>
          <div className="flex gap-1">
            <BenchControlButton
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => void refreshList().then(() => setCacheTick((n) => n + 1))}
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
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.txt,application/json,text/markdown"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void file.text().then((text) => importCharacterFile(text));
          }}
        />
        {!ready ? (
          <p className="text-sm text-foreground/60">…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">{t("combat.bench.sheetsError")}</p>
        ) : catalog.length === 0 ? (
          <div className="space-y-2 text-sm text-foreground/60">
            <p>{t("combat.bench.noSheets")}</p>
            <p>{t("combat.bench.noSheetsHint")}</p>
            <Link href="/character-sheet" className="font-semibold text-primary underline">
              {t("nav.sheets")}
            </Link>
          </div>
        ) : (
          <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
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
                    onClick={() => setPendingSheetId((prev) => (prev === sheet.id ? null : sheet.id))}
                    className={`cursor-grab rounded-xl border px-3 py-2 text-sm font-semibold active:cursor-grabbing ${
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
        {showImportError ? (
          <p className="text-xs text-danger">{t("list.importFailed")}</p>
        ) : null}
        <p className="text-xs text-foreground/50">{t("combat.bench.deployHint")}</p>

        {placements.length > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              {t("combat.bench.onMap")}
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {placements.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-xl border p-2 ${
                    selectedPlacementId === p.id ? "border-primary/50 bg-primary/5" : "border-foreground/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="decider"
                        checked={deciderPlacementId === p.id}
                        onChange={() => {
                          setDeciderPlacementId(p.id);
                          setSession(null);
                        }}
                      />
                      <button
                        type="button"
                        className="font-semibold text-left"
                        onClick={() => setSelectedPlacementId(p.id)}
                      >
                        {p.label}
                      </button>
                    </label>
                    <BenchControlButton
                      className="text-xs text-foreground/50 hover:text-danger"
                      onClick={() => removePlacement(p.id)}
                    >
                      ×
                    </BenchControlButton>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-foreground/50">
                    ({p.x.toFixed(1)}, {p.y.toFixed(1)}) m · {p.team}
                  </p>
                  <label className="mt-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase text-foreground/45">NPC 难度</span>
                    <select
                      className="rounded-lg border border-foreground/15 bg-background px-2 py-1 text-xs font-semibold"
                      value={p.profileId ?? "trained"}
                      disabled={busy}
                      onChange={(e) => setPlacementProfile(p.id, e.target.value as NpcDifficultyId)}
                    >
                      {NPC_DIFFICULTY_IDS.map((id) => (
                        <option key={id} value={id}>
                          {NPC_DIFFICULTY_LABELS[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BenchControlButton
                    className="mt-1 text-xs text-primary"
                    onClick={() => toggleTeam(p.id)}
                  >
                    {t("combat.bench.toggleTeam")}
                  </BenchControlButton>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <BenchControlButton
            className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-background disabled:opacity-40"
            disabled={!validation.ok || !mapSvg || busy}
            onClick={() => void startRound()}
          >
            {t("combat.bench.startRound")}
          </BenchControlButton>
          <BenchControlButton
            className="h-10 rounded-full border border-foreground/15 bg-background px-4 text-sm font-semibold disabled:opacity-40"
            disabled={!session || !benchMap || session.combatEnded || busy}
            onClick={() => void step()}
          >
            {t("combat.bench.step")}
            {stepProgress ? ` (${stepProgress})` : ""}
          </BenchControlButton>
          <BenchControlButton
            className="h-10 rounded-full px-4 text-sm font-semibold text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
            disabled={!session || busy}
            onClick={resetBench}
          >
            {t("combat.bench.resetRound")}
          </BenchControlButton>
          <BenchControlButton
            className="h-10 rounded-full border border-dashed border-foreground/20 px-4 text-sm font-semibold text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
            disabled={!session || busy}
            onClick={() => void copyRoundDebugJson()}
          >
            复制本回合调试 JSON
          </BenchControlButton>
          {debugCopyHint ? (
            <p className="text-center text-xs text-foreground/55">{debugCopyHint}</p>
          ) : null}
          {!validation.ok && placements.length > 0 ? (
            <p className="text-xs text-foreground/50">{t(`combat.bench.err.${validation.reason}`)}</p>
          ) : null}
          {lastStepLabel ? (
            <p className="break-all font-mono text-xs text-foreground/70">{lastStepLabel}</p>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <CombatBenchMap
          placements={placements}
          deciderPlacementId={deciderPlacementId}
          selectedPlacementId={selectedPlacementId}
          pendingSheetId={pendingSheetId}
          overlay={selectedMapOverlay}
          planMoveLegs={selectedActionBudget?.moveLegs ?? null}
          onPlaceSheet={placeSheet}
          onSelectPlacement={setSelectedPlacementId}
        />
        <CombatBenchActionBudgetPanel
          label={selectedPlacementLabel}
          budget={selectedActionBudget}
        />
        <CombatBenchInitiativePlans
          units={initiativePlanUnits}
          activePlacementId={currentTurn?.placementId ?? null}
          activeRound={activeInitiativeRound}
        />
        <CombatPlanIntents
          rows={intentRows}
          completedDeciderSlots={completedSlotsForCurrentActor}
          activeInitiativeRound={activeInitiativeRound}
          totalUtility={intentUtility}
          title={
            currentTurn
              ? `当前步进：${currentTurn.label}（主动段 ${currentTurn.slot + 1}）`
              : "当前步进"
          }
          emptyLabel="开始战斗轮后显示本步将执行的动作。"
        />
        <CombatBenchTopOptions
          units={topOptionUnits}
          emptyHint="开始战斗轮后为各单位计算 Top 选项。"
        />
      </div>

      <CombatBenchRosterSidebar units={rosterUnits} onSelectPlacement={setSelectedPlacementId} />
      </div>
    </div>
  );
}
