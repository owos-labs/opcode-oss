"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { BenchControlButton } from "@/app/components/bench-control-button";
import { CombatBenchActionBudgetPanel } from "@/app/components/combat-bench-action-budget-panel";
import { CombatBenchActionLogSidebar } from "@/app/components/combat-bench-action-log-sidebar";
import { CombatBenchMap } from "@/app/components/combat-bench-map";
import { CombatBenchInitiativePlans } from "@/app/components/combat-bench-initiative-plans";
import { CombatBenchTopOptions } from "@/app/components/combat-bench-top-options";
import { CombatInitiativeSequenceBar } from "@/app/components/combat-initiative-sequence-bar";
import { CombatPlanIntents } from "@/app/components/combat-plan-intents";
import type { CompiledCombatMap } from "@/lib/combat/map-adapter/compile";
import { useT } from "@/lib/character-sheets/i18n";
import { type NpcDifficultyId } from "@/lib/combat-ai/difficulty";
import { benchUnitStatusViews } from "@/lib/combat/combat-bench-unit-status";
import { parseImportedSheet, sheetListLabel } from "@/lib/character-sheets/model";
import {
  mergeSheetsById,
  readCombatBenchSheetCache,
  upsertCombatBenchSheetCache,
} from "@/lib/character-sheets/sheet-catalog";
import { opfsAvailable, writeSheet } from "@/lib/character-sheets/storage";
import { benchCombatEndLabel, type CombatBenchSession } from "@/lib/combat/combat-bench";
import { placementIsNeutralized } from "@/lib/combat/combat-bench-outcome";
import {
  benchStartValidation,
  defaultDeciderPlacementId,
  nextDefaultTeam,
  normalizeTeamId,
  type CombatMapPlacement,
} from "@/lib/combat/combat-bench-placements";
import {
  benchCanEditRoster,
  benchStartAllowed,
  benchStepAllowed,
  benchStepAtRoundBoundary,
} from "@/lib/combat/combat-bench-controls";
import { actorHintSlot, formatActorStepActionHint } from "@/lib/combat/actor-step-action-hint";
import { buildCombatBenchActionLog } from "@/lib/combat/combat-bench-action-log";
import { planIntentRows, planStayReason } from "@/lib/combat/combat-plan-intent";
import { remainingMoveBudgetMeters } from "@/lib/combat/movement";
import { buildCombatBenchActionBudgetView } from "@/lib/combat/combat-bench-action-budget";
import {
  buildCombatBenchCoverMarks,
  buildCombatBenchFsmHints,
  buildCombatBenchLocMarks,
  buildCombatBenchNavOverlay,
  buildCombatBenchPatrolPaths,
  buildCombatBenchMoveDebugHints,
  buildCombatBenchPlanFireLegs,
  buildCombatBenchPlanMoveLegs,
  buildCombatBenchSenseRings,
  buildCombatBenchWalkPreviews,
  buildSquadLeaderPlacementIds,
} from "@/lib/combat/combat-bench-map-graphics";
import { buildEncounterNav } from "@/lib/combat/patrol";
import {
  buildCombatBenchEffectLines,
  buildCombatBenchMapOverlay,
  buildCombatBenchUnitVisions,
} from "@/lib/combat/combat-bench-map-overlay";
import { weaponRangeBandRadii } from "@/lib/combat/weapon-range-bands";
import {
  buildCombatBenchRoundDebugJson,
  serializeCombatBenchRoundDebug,
} from "@/lib/combat/combat-bench-debug-export";
import {
  COMBAT_BENCH_MAPS,
  combatBenchMapMetersPerUnit,
  parseSvgViewBox,
} from "@/lib/combat/combat-test-scene";

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
  const [mapId, setMapId] = useState<string>(COMBAT_BENCH_MAPS[0]!.id);
  const [mapSvg, setMapSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importLocalError, setImportLocalError] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [benchMap, setBenchMap] = useState<CompiledCombatMap | null>(null);
  const [debugCopyHint, setDebugCopyHint] = useState<string | null>(null);

  useEffect(() => {
    const spec = COMBAT_BENCH_MAPS.find((m) => m.id === mapId) ?? COMBAT_BENCH_MAPS[0]!;
    setMapSvg(null);
    setBenchMap(null);
    setSession(null);
    setLastStepLabel(null);
    let cancelled = false;
    void fetch(spec.path)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setMapSvg(text);
      })
      .catch(() => {
        if (!cancelled) setMapSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  useEffect(() => {
    if (!mapSvg) return;
    let cancelled = false;
    void (async () => {
      const [{ compileOpcodeMap }, { combatTestPlaceholderDocument }] = await Promise.all([
        import("@/lib/combat/map-adapter/compile-opcode-map"),
        import("@/lib/combat/combat-test-scene"),
      ]);
      const viewBox = parseSvgViewBox(mapSvg);
      const metersPerUnit = viewBox ? combatBenchMapMetersPerUnit(mapId, viewBox.w) : undefined;
      const map = compileOpcodeMap(combatTestPlaceholderDocument(mapSvg, mapId, metersPerUnit));
      if (!cancelled) setBenchMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapSvg, mapId]);

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
      const team = nextDefaultTeam(placements);
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

  function setPlacementTeam(id: string, team: string) {
    const nextTeam = normalizeTeamId(team);
    if (!nextTeam) return;
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, team: nextTeam } : p)));
    setSession(null);
  }

  function movePlacement(id: string, x: number, y: number) {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
    setSession((prev) => (prev ? null : prev));
  }

  function removePlacement(id: string) {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setDeciderPlacementId((prev) => (prev === id ? null : prev));
    setSelectedPlacementId((prev) => (prev === id ? null : prev));
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
      const viewBox = parseSvgViewBox(mapSvg);
      const metersPerUnit = viewBox ? combatBenchMapMetersPerUnit(mapId, viewBox.w) : undefined;
      const map = compileOpcodeMap(combatTestPlaceholderDocument(mapSvg, mapId, metersPerUnit));
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
          ? `战斗已开始 · ${benchCombatEndLabel(next.endReason ?? "stalemate")}`
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

  const actionLogEntries = useMemo(() => buildCombatBenchActionLog(session), [session]);

  const selectedActionHint = useMemo(() => {
    if (!session || !selectedPlacementId || !selectedPlanBundle) return [];
    const slot = actorHintSlot({
      placementId: selectedPlacementId,
      turn: session.turnSequence[session.turnIndex] ?? null,
      actions: selectedPlanBundle.plan.actions,
      lastCompletedSlot: session.lastCompletedSlotByPlacementId?.[selectedPlacementId] ?? -1,
    });
    if (slot == null) return [];
    return formatActorStepActionHint({
      origin: selectedPlanBundle.snapshot.position,
      actions: selectedPlanBundle.plan.actions,
      slot,
      stancePositions: selectedPlanBundle.payload.stancePositions,
      targetIds: selectedPlanBundle.payload.targetIds,
      targetLabel: (id) => placementLabelById.get(id) ?? id.slice(0, 8),
      snapshot: selectedPlanBundle.snapshot,
      stayReason: planStayReason({
        payload: selectedPlanBundle.payload,
        actions: selectedPlanBundle.plan.actions,
        slot,
        movRemaining: remainingMoveBudgetMeters(
          selectedPlanBundle.snapshot.mov,
          selectedPlanBundle.snapshot.metersMovedThisRound,
        ),
        coverId: selectedPlanBundle.snapshot.coverId,
        profileId: selectedPlanBundle.snapshot.encounter.profileId,
      }),
    });
  }, [session, selectedPlacementId, selectedPlanBundle, placementLabelById]);

  const selectedPlacementLabel =
    placements.find((p) => p.id === selectedPlacementId)?.label ?? "—";

  const originByPlacementId = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    for (const unit of rosterUnits) out[unit.placementId] = unit.position;
    return out;
  }, [rosterUnits]);

  const senseRings = useMemo(
    () =>
      buildCombatBenchSenseRings({
        placements,
        sheetById,
        originByPlacementId,
      }),
    [placements, sheetById, originByPlacementId],
  );

  const visionUnits = useMemo(
    () =>
      rosterUnits.map((unit) => {
        const sense = senseRings.find((ring) => ring.placementId === unit.placementId);
        const runtime = session?.healthByPlacementId[unit.placementId];
        return {
          placementId: unit.placementId,
          team: unit.team,
          origin: unit.position,
          visionRangeM: sense?.openVisionV ?? 0,
          alive: runtime ? !placementIsNeutralized(runtime) : true,
        };
      }),
    [rosterUnits, senseRings],
  );

  const visions = useMemo(
    () => (benchMap ? buildCombatBenchUnitVisions({ map: benchMap, units: visionUnits }) : []),
    [benchMap, visionUnits],
  );

  const effectLines = useMemo(
    () =>
      benchMap
        ? buildCombatBenchEffectLines({ walls: benchMap.walls, units: visionUnits })
        : [],
    [benchMap, visionUnits],
  );

  const patrolPaths = useMemo(
    () =>
      buildCombatBenchPatrolPaths({
        placements,
        fsmByPlacementId: session?.fsmByPlacementId,
      }),
    [placements, session],
  );

  const navOverlay = useMemo(() => {
    const fromSession = Object.values(session?.plansByPlacementId ?? {})[0]?.snapshot.nav;
    const nav = fromSession ?? (benchMap ? buildEncounterNav(benchMap) : null);
    return buildCombatBenchNavOverlay(nav);
  }, [benchMap, session]);

  const planMoveLegs = useMemo(
    () => buildCombatBenchPlanMoveLegs(session?.plansByPlacementId),
    [session],
  );

  const walkPreviews = useMemo(
    () =>
      buildCombatBenchWalkPreviews({
        placements,
        plansByPlacementId: session?.plansByPlacementId,
        fsmByPlacementId: session?.fsmByPlacementId,
      }),
    [placements, session],
  );

  const moveDebugHints = useMemo(
    () => buildCombatBenchMoveDebugHints(session?.plansByPlacementId),
    [session],
  );

  const planFireLegs = useMemo(
    () => buildCombatBenchPlanFireLegs(session?.plansByPlacementId),
    [session],
  );

  const locMarks = useMemo(
    () =>
      buildCombatBenchLocMarks({
        observerId: selectedPlacementId,
        plansByPlacementId: session?.plansByPlacementId,
        labelById: (id) => placementLabelById.get(id) ?? id.slice(0, 8),
      }),
    [selectedPlacementId, session, placementLabelById],
  );

  const fsmHints = useMemo(
    () =>
      buildCombatBenchFsmHints({
        placements,
        plansByPlacementId: session?.plansByPlacementId,
        fsmByPlacementId: session?.fsmByPlacementId,
      }),
    [placements, session],
  );

  const coverMarks = useMemo(
    () =>
      benchMap
        ? buildCombatBenchCoverMarks({
            placements,
            plansByPlacementId: session?.plansByPlacementId,
            barriers: benchMap.barriers,
          })
        : [],
    [benchMap, placements, session],
  );

  const squadLeaderPlacementIds = useMemo(
    () =>
      buildSquadLeaderPlacementIds({
        placements,
        sheetById,
        healthByPlacementId: session?.healthByPlacementId,
      }),
    [placements, sheetById, session],
  );

  const selectedRangeBands = useMemo(() => {
    const unit = rosterUnits.find((u) => u.placementId === selectedPlacementId);
    return weaponRangeBandRadii(unit?.weapon?.rangeM ?? 0);
  }, [rosterUnits, selectedPlacementId]);

  const selectedMapOverlay = useMemo(() => {
    if (!benchMap || !selectedPlacementId) return null;
    const unit = rosterUnits.find((u) => u.placementId === selectedPlacementId);
    if (!unit || unit.mov === null) return null;
    const sense = senseRings.find((ring) => ring.placementId === selectedPlacementId);
    return buildCombatBenchMapOverlay({
      map: benchMap,
      origin: unit.position,
      mov: unit.mov,
      metersMovedThisRound: unit.metersMovedThisRound ?? 0,
      visionRangeM: sense?.openVisionV ?? 0,
    });
  }, [benchMap, selectedPlacementId, rosterUnits, senseRings]);

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
  const canStart = benchStartAllowed({
    session,
    validationOk: validation.ok,
    mapReady: Boolean(mapSvg),
    busy,
  });
  const canStep = benchStepAllowed({
    session,
    benchMapReady: Boolean(benchMap),
    busy,
  });
  const atRoundBoundary = benchStepAtRoundBoundary(session);
  const benchControls = (
    <>
      <BenchControlButton
        className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-background disabled:opacity-40"
        disabled={!canStart}
        onClick={() => void startRound()}
      >
        {t("combat.bench.startRound")}
      </BenchControlButton>
      <BenchControlButton
        className="h-8 rounded-lg border border-foreground/15 bg-background px-3 text-xs font-semibold disabled:opacity-40"
        disabled={!canStep}
        onClick={() => void step()}
      >
        {t("combat.bench.step")}
        {stepProgress ? ` (${stepProgress})` : ""}
      </BenchControlButton>
      {atRoundBoundary ? (
        <p className="px-1 text-center text-[10px] text-foreground/50">
          本 3 秒轮先攻段已跑完，继续点「步进」进入下一战斗轮。
        </p>
      ) : null}
      <BenchControlButton
        className="h-8 rounded-lg px-3 text-xs font-semibold text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
        disabled={!session || busy}
        onClick={resetBench}
      >
        {t("combat.bench.resetRound")}
      </BenchControlButton>
      {!validation.ok && placements.length > 0 ? (
        <p className="px-1 text-[10px] text-foreground/50">{t(`combat.bench.err.${validation.reason}`)}</p>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4 pb-2">
      <CombatInitiativeSequenceBar
        order={session?.initiativeOrder ?? []}
        turnSequence={session?.turnSequence ?? []}
        turnIndex={session?.turnIndex ?? 0}
        combatRound={session?.combatRound ?? null}
        combatEnded={session?.combatEnded ?? false}
        t={t}
        ready={ready}
        catalog={catalog}
        loadError={Boolean(loadError)}
        showImportError={Boolean(showImportError)}
        pendingSheetId={pendingSheetId}
        setPendingSheetId={setPendingSheetId}
        fileRef={fileRef}
        refreshList={() => void refreshList().then(() => setCacheTick((n) => n + 1))}
        placements={placements}
        selectedPlacementId={selectedPlacementId}
        deciderPlacementId={deciderPlacementId}
        busy={busy}
        rosterUnits={rosterUnits}
        onSelectPlacement={setSelectedPlacementId}
        onSetDecider={(id) => {
          setDeciderPlacementId(id);
          setSession(null);
        }}
        onRemovePlacement={removePlacement}
        rosterEditable={benchCanEditRoster(session)}
        onSetTeam={setPlacementTeam}
        onSetProfile={setPlacementProfile}
        onCopyDebugJson={() => void copyRoundDebugJson()}
        debugCopyHint={debugCopyHint}
        copyDebugDisabled={!session || busy}
        squadLeaderPlacementIds={squadLeaderPlacementIds}
      />
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-foreground/70">{t("combat.bench.mapLabel")}</span>
            <select
              className="rounded-lg border border-foreground/15 bg-background px-2 py-1 text-sm font-semibold"
              value={mapId}
              disabled={busy}
              onChange={(e) => setMapId(e.target.value)}
            >
              {COMBAT_BENCH_MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <CombatBenchMap
            svgMarkup={mapSvg}
            placements={placements}
            deciderPlacementId={deciderPlacementId}
            selectedPlacementId={selectedPlacementId}
            pendingSheetId={pendingSheetId}
            overlay={selectedMapOverlay}
            visions={visions}
            effectLines={effectLines}
            locMarks={locMarks}
            fsmHints={fsmHints}
            coverMarks={coverMarks}
            patrolPaths={patrolPaths}
            walkPreviews={walkPreviews}
            navOverlay={navOverlay}
            rangeBands={selectedRangeBands}
            planMoveLegs={planMoveLegs}
            planFireLegs={planFireLegs}
            moveDebugHints={moveDebugHints}
            squadLeaderPlacementIds={squadLeaderPlacementIds}
            metersPerUnit={benchMap?.metersPerUnit}
            actionHint={selectedActionHint}
            controls={benchControls}
            lastStepLabel={lastStepLabel}
            rosterEditable={benchCanEditRoster(session)}
            onPlaceSheet={placeSheet}
            onSelectPlacement={setSelectedPlacementId}
            onMovePlacement={benchCanEditRoster(session) ? movePlacement : undefined}
            onRemovePlacement={removePlacement}
            removeUnitLabel={t("combat.bench.removeUnit")}
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
        <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:max-h-[min(85dvh,900px)] lg:overflow-y-auto lg:overscroll-contain lg:scrollbar-subtle">
          <CombatBenchActionLogSidebar
            entries={actionLogEntries}
            stepProgress={stepProgress}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}
