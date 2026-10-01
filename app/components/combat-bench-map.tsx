"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { parseSvgViewBox, svgDefaultMetersPerUnit } from "@/lib/combat/combat-test-scene";
import {
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
  teamColorIndex,
  teamMarkerColor,
  type CombatMapPlacement,
} from "@/lib/combat/combat-bench-placements";
import type {
  CombatBenchCoverMark,
  CombatBenchFsmHint,
  CombatBenchLocMark,
  CombatBenchNavOverlay,
  CombatBenchPlanFireLeg,
  CombatBenchPatrolPath,
  CombatBenchWalkPreview,
  LabeledPlanMoveLeg,
} from "@/lib/combat/combat-bench-map-graphics";
import {
  coverMarkShortLabel,
  locLevelShortLabel,
  mapScaleBarPx,
  niceMapScaleMeters,
  markerDifficultyLabel,
  planFireKindLabel,
  svgArrowHeadPoints,
} from "@/lib/combat/combat-bench-map-graphics";
import { placementProfileId } from "@/lib/combat/combat-bench-initiative";
import {
  combatRenderOpacity,
  type CombatBenchEffectLine,
  type CombatBenchMapOverlay,
  type CombatBenchUnitVision,
} from "@/lib/combat/combat-bench-map-overlay";
import { prepareCombatMapSvgForDisplay } from "@/lib/combat/combat-map-svg-display";
import { combatTestActorSvgUserPoint } from "@/lib/combat/combat-test-scene";

const TEAM_MARKER = [
  "bg-danger text-white",
  "bg-primary text-background",
  "bg-amber-500 text-background",
  "bg-violet-500 text-white",
  "bg-cyan-600 text-white",
  "bg-lime-600 text-background",
] as const;

function teamMarkerClass(team: string | undefined) {
  if (!team) return "bg-foreground/80 text-background";
  return TEAM_MARKER[teamColorIndex(team)] ?? "bg-foreground/80 text-background";
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3.5;

const PLAN_ROUND_STROKE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e"] as const;
const ROOM_FILL = ["#38bdf8", "#a78bfa", "#f59e0b", "#34d399", "#f472b6", "#fb7185"] as const;

function metersToSvgPoint(
  x: number,
  y: number,
  viewBox: NonNullable<ReturnType<typeof parseSvgViewBox>>,
  metersPerUnit?: number,
) {
  return combatTestActorSvgUserPoint({ x, y }, viewBox, metersPerUnit);
}

function meterRadiusSvg(
  radiusM: number,
  viewBox: NonNullable<ReturnType<typeof parseSvgViewBox>>,
  metersPerUnit?: number,
) {
  return radiusM / (metersPerUnit ?? svgDefaultMetersPerUnit(viewBox.w));
}

function polyPoints(
  points: readonly { x: number; y: number }[],
  viewBox: NonNullable<ReturnType<typeof parseSvgViewBox>>,
  metersPerUnit?: number,
) {
  return points
    .map((p) => {
      const s = metersToSvgPoint(p.x, p.y, viewBox, metersPerUnit);
      return `${s.x},${s.y}`;
    })
    .join(" ");
}

export function CombatBenchMap({
  svgMarkup,
  placements,
  deciderPlacementId,
  selectedPlacementId,
  pendingSheetId,
  overlay,
  visions,
  effectLines,
  locMarks,
  fsmHints,
  coverMarks,
  patrolPaths,
  walkPreviews,
  navOverlay,
  rangeBands,
  planMoveLegs,
  planFireLegs,
  moveDebugHints,
  squadLeaderPlacementIds,
  metersPerUnit,
  actionHint = [],
  controls,
  lastStepLabel,
  rosterEditable = false,
  onPlaceSheet,
  onSelectPlacement,
  onMovePlacement,
  onRemovePlacement,
  removeUnitLabel = "移除单位",
}: {
  svgMarkup: string | null;
  placements: readonly CombatMapPlacement[];
  deciderPlacementId: string | null;
  selectedPlacementId: string | null;
  pendingSheetId: string | null;
  overlay?: CombatBenchMapOverlay | null;
  visions?: readonly CombatBenchUnitVision[] | null;
  effectLines?: readonly CombatBenchEffectLine[] | null;
  locMarks?: readonly CombatBenchLocMark[] | null;
  fsmHints?: readonly CombatBenchFsmHint[] | null;
  coverMarks?: readonly CombatBenchCoverMark[] | null;
  patrolPaths?: readonly CombatBenchPatrolPath[] | null;
  walkPreviews?: readonly CombatBenchWalkPreview[] | null;
  navOverlay?: CombatBenchNavOverlay | null;
  rangeBands?: readonly { id: string; label: string; radiusM: number }[] | null;
  planMoveLegs?: readonly LabeledPlanMoveLeg[] | null;
  planFireLegs?: readonly CombatBenchPlanFireLeg[] | null;
  moveDebugHints?: readonly { placementId: string; text: string }[] | null;
  squadLeaderPlacementIds?: ReadonlySet<string>;
  metersPerUnit?: number;
  actionHint?: readonly string[];
  controls?: ReactNode;
  lastStepLabel?: string | null;
  rosterEditable?: boolean;
  onPlaceSheet: (sheetId: string, x: number, y: number) => void;
  onSelectPlacement: (placementId: string) => void;
  onMovePlacement?: (placementId: string, x: number, y: number) => void;
  onRemovePlacement?: (placementId: string) => void;
  removeUnitLabel?: string;
}) {
  const unitVisions = visions ?? [];
  const losLines = effectLines ?? [];
  const locs = locMarks ?? [];
  const fsm = fsmHints ?? [];
  const covers = coverMarks ?? [];
  const patrols = patrolPaths ?? [];
  const walks = walkPreviews ?? [];
  const bands = rangeBands ?? [];
  const moveLegs = planMoveLegs ?? [];
  const fireLegs = planFireLegs ?? [];
  const moveDebug = moveDebugHints ?? [];
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingPlacementId, setDraggingPlacementId] = useState<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);
  const markerDragRef = useRef<{
    pointerId: number;
    placementId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, [svgMarkup]);

  const viewBox = useMemo(() => (svgMarkup ? parseSvgViewBox(svgMarkup) : null), [svgMarkup]);
  const mpu = metersPerUnit ?? (viewBox ? svgDefaultMetersPerUnit(viewBox.w) : 1);
  const displaySvg = useMemo(
    () => (svgMarkup ? prepareCombatMapSvgForDisplay(svgMarkup) : null),
    [svgMarkup],
  );

  const mapPixelSize = useMemo(() => {
    if (!viewBox) return { w: 1044, h: 645 };
    return { w: viewBox.w, h: viewBox.h };
  }, [viewBox]);

  function metersAtClient(clientX: number, clientY: number, clamp = false) {
    if (!viewBox || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const localX = (clientX - rect.left - pan.x) / scale;
    const localY = (clientY - rect.top - pan.y) / scale;
    let leftPct = (localX / mapPixelSize.w) * 100;
    let topPct = (localY / mapPixelSize.h) * 100;
    if (clamp) {
      leftPct = Math.min(100, Math.max(0, leftPct));
      topPct = Math.min(100, Math.max(0, topPct));
    } else if (leftPct < 0 || leftPct > 100 || topPct < 0 || topPct > 100) {
      return null;
    }
    return svgPercentToMeterPosition(leftPct, topPct, viewBox, mpu);
  }

  function onMarkerPointerDown(e: React.PointerEvent, placementId: string) {
    e.stopPropagation();
    if (!rosterEditable || !onMovePlacement || e.button !== 0) return;
    markerDragRef.current = {
      pointerId: e.pointerId,
      placementId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMarkerPointerMove(e: React.PointerEvent) {
    const drag = markerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !onMovePlacement) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <= 4) return;
    const meters = metersAtClient(e.clientX, e.clientY, true);
    if (!meters) return;
    drag.moved = true;
    setDraggingPlacementId(drag.placementId);
    onMovePlacement(drag.placementId, meters.x, meters.y);
  }

  function onMarkerPointerUp(e: React.PointerEvent) {
    const drag = markerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    markerDragRef.current = null;
    setDraggingPlacementId(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const sheetId =
      e.dataTransfer.getData("text/plain") ||
      e.dataTransfer.getData("application/x-opcode-sheet-id");
    if (!sheetId) return;
    const meters = metersAtClient(e.clientX, e.clientY);
    if (!meters) return;
    onPlaceSheet(sheetId, meters.x, meters.y);
  }

  function handleClick(e: React.MouseEvent) {
    if (dragRef.current?.moved) return;
    if (!pendingSheetId) return;
    const meters = metersAtClient(e.clientX, e.clientY);
    if (!meters) return;
    onPlaceSheet(pendingSheetId, meters.x, meters.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-combat-marker]")) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
      moved: false,
    };
    viewportRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      setIsDragging(true);
    }
    setPan({ x: drag.originPanX + dx, y: drag.originPanY + dy });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
      viewportRef.current?.releasePointerCapture(e.pointerId);
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
  }

  if (!displaySvg || !viewBox) return <p className="text-sm text-foreground/60">…</p>;

  const cursor = pendingSheetId ? "crosshair" : isDragging ? "grabbing" : "grab";
  const selectedPlacement = selectedPlacementId
    ? placements.find((p) => p.id === selectedPlacementId)
    : undefined;
  const mapWidthM = viewBox.w * mpu;
  const scaleTickM = niceMapScaleMeters(mapWidthM);
  const scaleBarPx = mapScaleBarPx(scaleTickM, scale, mpu);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border bg-foreground/5 ${
        pendingSheetId ? "border-primary ring-2 ring-primary/30" : "border-foreground/10"
      }`}
    >
      {rosterEditable && selectedPlacement && onRemovePlacement ? (
        <div className="absolute left-2 top-2 z-20 flex max-w-[min(100%-1rem,20rem)] flex-wrap items-center gap-2 rounded-lg border border-foreground/10 bg-background/95 px-2 py-1.5 shadow-sm">
          <span className="truncate text-[11px] font-semibold text-foreground">
            {selectedPlacement.label}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-danger/30 bg-danger/5 px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePlacement(selectedPlacement.id);
            }}
          >
            {removeUnitLabel}
          </button>
        </div>
      ) : null}
      <p className="pointer-events-none absolute right-2 top-2 z-20 rounded-lg bg-background/80 px-2 py-0.5 text-[10px] text-foreground/55">
        {rosterEditable ? "拖角色换位 · " : ""}拖拽平移 · Ctrl+滚轮缩放
        {unitVisions.length > 0 ? " · 队色=视野锥" : ""}
        {locs.length > 0 ? " · 虚线=定位" : ""}
        {overlay && selectedPlacementId ? " · 绿=可移动" : ""}
        {navOverlay && (navOverlay.rooms.length > 0 || navOverlay.edges.length > 0)
          ? " · 色块=房间 · 灰线=巡逻图"
          : ""}
        {patrols.length > 0 ? " · 彩虚=Hunt路线" : ""}
        {losLines.length > 0 ? " · 红=互见" : ""}
        {moveLegs.length > 0 ? " · 实线=移动" : ""}
        {fireLegs.length > 0 ? " · 虚线箭头=射击" : ""}
        {squadLeaderPlacementIds && squadLeaderPlacementIds.size > 0 ? " · 队=队长" : ""}
        {" · 角标=难度"}
      </p>
      <div
        ref={viewportRef}
        role="presentation"
        className="relative h-[min(65vh,620px)] w-full touch-none"
        style={{ cursor }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          ref={canvasRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: mapPixelSize.w,
            height: mapPixelSize.h,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <div
            className="pointer-events-none size-full [&_svg]:block [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: displaySvg }}
          />
          {navOverlay && (navOverlay.rooms.length > 0 || navOverlay.edges.length > 0) ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[2] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {navOverlay.rooms.map((room, i) => {
                const fill = ROOM_FILL[i % ROOM_FILL.length]!;
                const c = metersToSvgPoint(room.centroid.x, room.centroid.y, viewBox, mpu);
                return (
                  <g key={room.id}>
                    {room.hull.length >= 3 ? (
                      <polygon
                        points={polyPoints(room.hull, viewBox, mpu)}
                        fill={fill}
                        fillOpacity={0.16}
                        stroke={fill}
                        strokeOpacity={0.7}
                        strokeWidth={viewBox.w * 0.0014}
                      />
                    ) : null}
                    {room.cells.map((cell, ci) => {
                      const p = metersToSvgPoint(cell.x, cell.y, viewBox, mpu);
                      return (
                        <circle
                          key={`${room.id}-c${ci}`}
                          cx={p.x}
                          cy={p.y}
                          r={viewBox.w * 0.0016}
                          fill={fill}
                          fillOpacity={0.45}
                        />
                      );
                    })}
                    <circle cx={c.x} cy={c.y} r={viewBox.w * 0.005} fill={fill} fillOpacity={0.85} />
                    <text
                      x={c.x}
                      y={c.y - viewBox.w * 0.007}
                      textAnchor="middle"
                      fontSize={viewBox.w * 0.011}
                      fill={fill}
                      fontWeight={700}
                    >
                      {room.id.replace("room-", "R")}
                    </text>
                  </g>
                );
              })}
              {navOverlay.edges.map((edge) => {
                const a = metersToSvgPoint(edge.from.x, edge.from.y, viewBox, mpu);
                const b = metersToSvgPoint(edge.to.x, edge.to.y, viewBox, mpu);
                return (
                  <line
                    key={edge.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgb(148 163 184 / 0.7)"
                    strokeWidth={viewBox.w * 0.0011}
                  />
                );
              })}
              {navOverlay.nodes.map((node) => {
                const p = metersToSvgPoint(node.position.x, node.position.y, viewBox, mpu);
                const isRoom = node.kind === "room";
                return (
                  <circle
                    key={node.id}
                    cx={p.x}
                    cy={p.y}
                    r={viewBox.w * (isRoom ? 0.004 : 0.0032)}
                    fill={isRoom ? "rgb(56 189 248 / 0.9)" : "rgb(250 204 21 / 0.85)"}
                    stroke="rgb(15 23 42 / 0.45)"
                    strokeWidth={viewBox.w * 0.0006}
                  />
                );
              })}
            </svg>
          ) : null}
          {patrols.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[3] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {patrols.map((path) => {
                const stroke = teamMarkerColor(path.team);
                return (
                  <g key={`patrol-${path.placementId}`}>
                    <polyline
                      points={polyPoints(path.waypoints, viewBox, mpu)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={viewBox.w * 0.0014}
                      strokeOpacity={0.7}
                      strokeDasharray={`${viewBox.w * 0.008} ${viewBox.w * 0.005}`}
                    />
                    {path.waypoints.map((wp, i) => {
                      const p = metersToSvgPoint(wp.x, wp.y, viewBox, mpu);
                      const current = i === path.currentIndex % path.waypoints.length;
                      return (
                        <circle
                          key={`${path.placementId}-${i}`}
                          cx={p.x}
                          cy={p.y}
                          r={viewBox.w * (current ? 0.007 : 0.004)}
                          fill={current ? "rgb(234 179 8 / 0.9)" : stroke}
                          fillOpacity={current ? 0.9 : 0.45}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          ) : null}
          {bands.length > 0 && selectedPlacement ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[4] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {bands.map((band) => {
                  const origin = selectedPlacement;
                  const c = metersToSvgPoint(origin.x, origin.y, viewBox, mpu);
                  const stroke =
                    band.id === "pointBlank"
                      ? "rgb(245 158 11 / 0.55)"
                      : band.id === "close"
                        ? "rgb(14 165 233 / 0.45)"
                        : band.id === "medium"
                          ? "rgb(34 197 94 / 0.4)"
                          : "rgb(244 63 94 / 0.35)";
                  return (
                    <circle
                      key={band.id}
                      cx={c.x}
                      cy={c.y}
                      r={meterRadiusSvg(band.radiusM, viewBox, mpu)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={viewBox.w * 0.0009}
                    />
                  );
                })}
            </svg>
          ) : null}
          {unitVisions.length > 0 || losLines.length > 0 || (overlay && selectedPlacementId) ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[5] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {unitVisions.map((vision) => {
                if (vision.polygon.length < 3) return null;
                const opacity = combatRenderOpacity(vision.alive);
                return (
                  <polygon
                    key={vision.placementId}
                    points={polyPoints(vision.polygon, viewBox, mpu)}
                    fill={teamMarkerColor(vision.team)}
                    fillOpacity={0.1 * opacity}
                    stroke={teamMarkerColor(vision.team)}
                    strokeOpacity={0.45 * opacity}
                    strokeWidth={viewBox.w * 0.0012}
                  />
                );
              })}
              {overlay && selectedPlacementId && overlay.movementDisk.length >= 3 ? (
                <polygon
                  points={polyPoints(overlay.movementDisk, viewBox, mpu)}
                  fill="rgb(34 197 94 / 0.2)"
                  stroke="rgb(22 163 74 / 0.55)"
                  strokeWidth={viewBox.w * 0.0015}
                />
              ) : null}
              {losLines.map((line) => {
                const a = metersToSvgPoint(line.from.x, line.from.y, viewBox, mpu);
                const b = metersToSvgPoint(line.to.x, line.to.y, viewBox, mpu);
                return (
                  <line
                    key={`${line.fromId}-${line.toId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgb(239 68 68 / 0.75)"
                    strokeWidth={viewBox.w * 0.0016}
                  />
                );
              })}
            </svg>
          ) : null}
          {walks.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[6] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {walks.map((walk) => (
                <g key={`walk-${walk.placementId}`}>
                  <polyline
                    points={polyPoints(walk.polyline, viewBox, mpu)}
                    fill="none"
                    stroke="rgb(56 189 248 / 0.85)"
                    strokeWidth={viewBox.w * 0.0016}
                    strokeDasharray={`${viewBox.w * 0.005} ${viewBox.w * 0.004}`}
                  />
                  {walk.steps.map((step, i) => {
                    const p = metersToSvgPoint(step.x, step.y, viewBox, mpu);
                    return (
                      <g key={`walk-${walk.placementId}-${i}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={viewBox.w * 0.0045}
                          fill="rgb(14 165 233 / 0.9)"
                          stroke="rgb(15 23 42 / 0.45)"
                          strokeWidth={viewBox.w * 0.0005}
                        />
                        <text
                          x={p.x}
                          y={p.y - viewBox.w * 0.007}
                          textAnchor="middle"
                          fontSize={viewBox.w * 0.01}
                          fill="rgb(12 74 110)"
                          fontWeight={700}
                        >
                          {i + 1}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          ) : null}
          {moveLegs.length > 0 || fireLegs.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[6] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {moveLegs.map((leg, i) => {
                const path = (leg.path?.length ?? 0) >= 2 ? leg.path : [leg.from, leg.to];
                const b = metersToSvgPoint(leg.to.x, leg.to.y, viewBox, mpu);
                const stroke = PLAN_ROUND_STROKE[leg.round % PLAN_ROUND_STROKE.length] ?? "#0ea5e9";
                const sw = viewBox.w * 0.0018;
                return (
                  <g key={`move-${leg.placementId}-${leg.planIndex}-${i}`}>
                    <polyline
                      points={polyPoints(path, viewBox, mpu)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeOpacity={0.85}
                    />
                    <circle cx={b.x} cy={b.y} r={viewBox.w * 0.005} fill={stroke} fillOpacity={0.35} />
                    <text
                      x={b.x}
                      y={b.y - viewBox.w * 0.008}
                      textAnchor="middle"
                      fontSize={viewBox.w * 0.012}
                      fill={stroke}
                      fontWeight={700}
                    >
                      R{leg.round + 1}
                    </text>
                  </g>
                );
              })}
              {fireLegs.map((leg, i) => {
                const a = metersToSvgPoint(leg.from.x, leg.from.y, viewBox, mpu);
                const b = metersToSvgPoint(leg.to.x, leg.to.y, viewBox, mpu);
                const stroke = PLAN_ROUND_STROKE[leg.round % PLAN_ROUND_STROKE.length] ?? "#f43f5e";
                const head = svgArrowHeadPoints(a, b, viewBox.w * 0.012);
                return (
                  <g key={`fire-${leg.placementId}-${leg.planIndex}-${i}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={viewBox.w * 0.0014}
                      strokeOpacity={0.75}
                      strokeDasharray={`${viewBox.w * 0.007} ${viewBox.w * 0.004}`}
                    />
                    {head ? <polygon points={head} fill={stroke} fillOpacity={0.9} /> : null}
                    <text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - viewBox.w * 0.006}
                      textAnchor="middle"
                      fontSize={viewBox.w * 0.011}
                      fill={stroke}
                      fontWeight={700}
                    >
                      {planFireKindLabel(leg)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : null}
          {covers.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[7] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {covers.map((mark) => {
                const a = metersToSvgPoint(mark.a.x, mark.a.y, viewBox, mpu);
                const b = metersToSvgPoint(mark.b.x, mark.b.y, viewBox, mpu);
                const from = metersToSvgPoint(mark.from.x, mark.from.y, viewBox, mpu);
                const to = metersToSvgPoint(mark.to.x, mark.to.y, viewBox, mpu);
                const stroke = teamMarkerColor(mark.team);
                const entered = mark.kind === "entered";
                return (
                  <g key={`cover-${mark.placementId}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={viewBox.w * (entered ? 0.0042 : 0.0028)}
                      strokeOpacity={entered ? 0.95 : 0.7}
                      strokeDasharray={entered ? undefined : `${viewBox.w * 0.006} ${viewBox.w * 0.004}`}
                    />
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={stroke}
                      strokeWidth={viewBox.w * 0.0012}
                      strokeOpacity={0.55}
                      strokeDasharray={`${viewBox.w * 0.003} ${viewBox.w * 0.003}`}
                    />
                  </g>
                );
              })}
            </svg>
          ) : null}
          {locs.length > 0 || fsm.some((hint) => hint.destination) ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[7] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {locs.map((mark) => {
                const a = metersToSvgPoint(mark.from.x, mark.from.y, viewBox, mpu);
                const b = metersToSvgPoint(mark.to.x, mark.to.y, viewBox, mpu);
                const dashed = mark.level === "approximate";
                return (
                  <g key={`loc-${mark.observerId}-${mark.targetId}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="rgb(234 179 8 / 0.75)"
                      strokeWidth={viewBox.w * 0.0013}
                      strokeDasharray={
                        dashed ? `${viewBox.w * 0.006} ${viewBox.w * 0.004}` : undefined
                      }
                    />
                    <text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - viewBox.w * 0.005}
                      textAnchor="middle"
                      fontSize={viewBox.w * 0.01}
                      fill="rgb(161 98 7)"
                      fontWeight={700}
                    >
                      {mark.targetLabel} · {locLevelShortLabel(mark.level)}
                    </text>
                  </g>
                );
              })}
              {fsm.map((hint) => {
                if (!hint.destination) return null;
                if (walks.some((walk) => walk.placementId === hint.placementId)) return null;
                const placement = placements.find((p) => p.id === hint.placementId);
                if (!placement) return null;
                const a = metersToSvgPoint(placement.x, placement.y, viewBox, mpu);
                const b = metersToSvgPoint(hint.destination.x, hint.destination.y, viewBox, mpu);
                return (
                  <line
                    key={`fsm-dest-${hint.placementId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgb(148 163 184 / 0.45)"
                    strokeWidth={viewBox.w * 0.001}
                    strokeDasharray={`${viewBox.w * 0.004} ${viewBox.w * 0.004}`}
                  />
                );
              })}
            </svg>
          ) : null}
          {placements.map((p) => {
            const pct = meterPositionToMarkerPercent(p.x, p.y, viewBox, mpu);
            const isDecider = p.id === deciderPlacementId;
            const isSelected = p.id === selectedPlacementId;
            const isSquadLeader = squadLeaderPlacementIds?.has(p.id) ?? false;
            const dragging = draggingPlacementId === p.id;
            const fsmHint = fsm.find((hint) => hint.placementId === p.id);
            const locOnMe = locs.find((mark) => mark.targetId === p.id);
            const moveHint = moveDebug.find((hint) => hint.placementId === p.id);
            const coverMark = covers.find((mark) => mark.placementId === p.id);
            const difficulty = markerDifficultyLabel(placementProfileId(p));
            const coverLabel = coverMark ? coverMarkShortLabel(coverMark) : null;
            return (
              <div
                key={p.id}
                data-combat-marker
                className={`pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 ${
                  dragging ? "" : "transition-[left,top] duration-300 ease-linear motion-reduce:transition-none"
                }`}
                style={{ left: `${pct.leftPct}%`, top: `${pct.topPct}%` }}
                title={`${p.label} · ${difficulty}${isSquadLeader ? " · 队长" : ""}${coverLabel ? ` · ${coverLabel}` : ""} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) m`}
              >
                <button
                  type="button"
                  className={`relative flex min-w-7 items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-black shadow-md ring-2 ${teamMarkerClass(p.team)} ${
                    isDecider ? "ring-primary ring-offset-2 ring-offset-background" : "ring-background"
                  } ${isSquadLeader && !isDecider ? "ring-amber-400 ring-offset-1 ring-offset-background" : ""} ${
                    isSelected ? "outline outline-2 outline-offset-1 outline-amber-400" : ""
                  } ${rosterEditable ? "cursor-grab active:cursor-grabbing" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlacement(p.id);
                  }}
                  onPointerDown={(e) => onMarkerPointerDown(e, p.id)}
                  onPointerMove={onMarkerPointerMove}
                  onPointerUp={onMarkerPointerUp}
                  onPointerCancel={onMarkerPointerUp}
                >
                  {p.label.slice(0, 2)}
                  {isSquadLeader ? (
                    <span
                      className="absolute -right-1.5 -top-1.5 rounded-sm bg-amber-400 px-0.5 text-[8px] font-black leading-none text-background shadow"
                      aria-hidden
                    >
                      队
                    </span>
                  ) : null}
                  {coverMark ? (
                    <span
                      className={`absolute -left-1.5 -top-1.5 rounded-sm px-0.5 text-[8px] font-black leading-none shadow ${
                        coverMark.kind === "entered"
                          ? "bg-slate-800 text-white"
                          : "bg-background/95 text-foreground ring-1 ring-foreground/25"
                      }`}
                      aria-hidden
                    >
                      掩
                    </span>
                  ) : null}
                  <span
                    className="absolute -left-1.5 -bottom-1.5 rounded-sm bg-background/95 px-0.5 text-[8px] font-black leading-none text-foreground shadow ring-1 ring-foreground/20"
                    aria-hidden
                  >
                    {difficulty}
                  </span>
                </button>
                {isSelected && actionHint.length > 0 ? (
                  <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
                    <div className="whitespace-nowrap rounded-md border border-foreground/15 bg-background/95 px-2 py-1 font-mono text-[10px] leading-snug text-foreground shadow-sm">
                      {actionHint.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {fsmHint || locOnMe || moveHint || coverLabel ? (
                  <div className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-background/90 px-1 py-px text-[8px] font-semibold text-foreground/70 shadow-sm">
                    {coverLabel}
                    {coverLabel && (fsmHint || locOnMe || moveHint) ? " · " : null}
                    {fsmHint ? fsmHint.text : null}
                    {fsmHint && locOnMe ? " · " : null}
                    {locOnMe ? locLevelShortLabel(locOnMe.level) : null}
                    {(fsmHint || locOnMe) && moveHint ? " · " : null}
                    {moveHint ? moveHint.text : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 flex items-end gap-2">
          <div className="rounded-lg border border-foreground/10 bg-background/90 px-2 py-1.5 shadow-sm">
            <div
              className="h-0.5 bg-foreground/70"
              style={{ width: Math.max(28, Math.min(160, scaleBarPx)) }}
            />
            <p className="mt-0.5 font-mono text-[10px] text-foreground/60">{scaleTickM} m</p>
          </div>
        </div>
        {controls || lastStepLabel ? (
          <div className="absolute bottom-2 right-2 z-30 flex max-w-[min(100%-1rem,18rem)] flex-col items-end gap-1.5">
            {lastStepLabel ? (
              <p className="pointer-events-none rounded-lg border border-foreground/10 bg-background/90 px-2 py-1 text-[10px] leading-snug text-foreground/70 shadow-sm">
                {lastStepLabel}
              </p>
            ) : null}
            {controls ? (
              <div
                className="flex flex-col items-stretch gap-1 rounded-xl border border-foreground/10 bg-background/95 p-1.5 shadow-md"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {controls}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
