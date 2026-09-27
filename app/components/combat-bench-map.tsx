"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  COMBAT_TEST_MAP_SVG_PATH,
  parseSvgViewBox,
} from "@/lib/combat/combat-test-scene";
import {
  meterPositionToMarkerPercent,
  svgPercentToMeterPosition,
  type CombatMapPlacement,
} from "@/lib/combat/combat-bench-placements";
import type { PlanMoveLeg } from "@/lib/combat/combat-bench-action-budget";
import type { CombatBenchMapOverlay } from "@/lib/combat/combat-bench-map-overlay";
import { prepareCombatMapSvgForDisplay } from "@/lib/combat/combat-map-svg-display";
import { combatTestActorSvgUserPoint } from "@/lib/combat/combat-test-scene";

function teamMarkerClass(team: string | undefined) {
  if (team === "hostile") return "bg-danger text-white";
  if (team === "friendly") return "bg-primary text-background";
  return "bg-foreground/80 text-background";
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3.5;

const PLAN_ROUND_STROKE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e"] as const;

function metersToSvgPoint(x: number, y: number, viewBox: NonNullable<ReturnType<typeof parseSvgViewBox>>) {
  return combatTestActorSvgUserPoint({ x, y }, viewBox);
}

export function CombatBenchMap({
  placements,
  deciderPlacementId,
  selectedPlacementId,
  pendingSheetId,
  overlay,
  planMoveLegs,
  onPlaceSheet,
  onSelectPlacement,
}: {
  placements: readonly CombatMapPlacement[];
  deciderPlacementId: string | null;
  selectedPlacementId: string | null;
  pendingSheetId: string | null;
  overlay?: CombatBenchMapOverlay | null;
  planMoveLegs?: readonly PlanMoveLeg[] | null;
  onPlaceSheet: (sheetId: string, x: number, y: number) => void;
  onSelectPlacement: (placementId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(COMBAT_TEST_MAP_SVG_PATH);
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (!cancelled) setSvgMarkup(text);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const viewBox = useMemo(() => (svgMarkup ? parseSvgViewBox(svgMarkup) : null), [svgMarkup]);
  const displaySvg = useMemo(
    () => (svgMarkup ? prepareCombatMapSvgForDisplay(svgMarkup) : null),
    [svgMarkup],
  );

  const mapPixelSize = useMemo(() => {
    if (!viewBox) return { w: 1044, h: 645 };
    return { w: viewBox.w, h: viewBox.h };
  }, [viewBox]);

  function metersAtClient(clientX: number, clientY: number) {
    if (!viewBox || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const localX = (clientX - rect.left - pan.x) / scale;
    const localY = (clientY - rect.top - pan.y) / scale;
    const leftPct = (localX / mapPixelSize.w) * 100;
    const topPct = (localY / mapPixelSize.h) * 100;
    if (leftPct < 0 || leftPct > 100 || topPct < 0 || topPct > 100) return null;
    return svgPercentToMeterPosition(leftPct, topPct, viewBox);
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
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!displaySvg || !viewBox) return <p className="text-sm text-foreground/60">…</p>;

  const cursor = pendingSheetId ? "crosshair" : isDragging ? "grabbing" : "grab";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border bg-foreground/5 ${
        pendingSheetId ? "border-primary ring-2 ring-primary/30" : "border-foreground/10"
      }`}
    >
      <p className="pointer-events-none absolute right-2 top-2 z-20 rounded-lg bg-background/80 px-2 py-0.5 text-[10px] text-foreground/55">
        拖拽平移 · 滚轮缩放
        {overlay && selectedPlacementId ? " · 青=视野 · 绿=可移动" : ""}
        {planMoveLegs && planMoveLegs.length > 0 ? " · 彩线=计划移动" : ""}
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
          {overlay && selectedPlacementId ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[5] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {overlay.visibility.length >= 3 ? (
                <polygon
                  points={overlay.visibility
                    .map((p) => {
                      const s = metersToSvgPoint(p.x, p.y, viewBox);
                      return `${s.x},${s.y}`;
                    })
                    .join(" ")}
                  fill="rgb(56 189 248 / 0.22)"
                  stroke="rgb(14 165 233 / 0.55)"
                  strokeWidth={viewBox.w * 0.0015}
                />
              ) : null}
              {overlay.movementDisk.length >= 3 ? (
                <polygon
                  points={overlay.movementDisk
                    .map((p) => {
                      const s = metersToSvgPoint(p.x, p.y, viewBox);
                      return `${s.x},${s.y}`;
                    })
                    .join(" ")}
                  fill="rgb(34 197 94 / 0.2)"
                  stroke="rgb(22 163 74 / 0.55)"
                  strokeWidth={viewBox.w * 0.0015}
                />
              ) : null}
              {(() => {
                const o = metersToSvgPoint(overlay.origin.x, overlay.origin.y, viewBox);
                return (
                  <circle
                    cx={o.x}
                    cy={o.y}
                    r={viewBox.w * 0.006}
                    fill="none"
                    stroke="rgb(251 191 36 / 0.9)"
                    strokeWidth={viewBox.w * 0.0012}
                    strokeDasharray={`${viewBox.w * 0.008} ${viewBox.w * 0.004}`}
                  />
                );
              })()}
            </svg>
          ) : null}
          {planMoveLegs && planMoveLegs.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[6] size-full"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              aria-hidden
            >
              {planMoveLegs.map((leg, i) => {
                const a = metersToSvgPoint(leg.from.x, leg.from.y, viewBox);
                const b = metersToSvgPoint(leg.to.x, leg.to.y, viewBox);
                const stroke = PLAN_ROUND_STROKE[leg.round % PLAN_ROUND_STROKE.length] ?? "#0ea5e9";
                const sw = viewBox.w * 0.0018;
                return (
                  <g key={`${leg.planIndex}-${i}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeOpacity={0.85}
                      markerEnd="url(#combat-plan-arrow)"
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
              <defs>
                <marker
                  id="combat-plan-arrow"
                  markerWidth={6}
                  markerHeight={6}
                  refX={5}
                  refY={3}
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="#0ea5e9" />
                </marker>
              </defs>
            </svg>
          ) : null}
          {placements.map((p) => {
            const pct = meterPositionToMarkerPercent(p.x, p.y, viewBox);
            const isDecider = p.id === deciderPlacementId;
            const isSelected = p.id === selectedPlacementId;
            return (
              <div
                key={p.id}
                data-combat-marker
                className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pct.leftPct}%`, top: `${pct.topPct}%` }}
                title={`${p.label} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) m`}
              >
                <button
                  type="button"
                  className={`flex min-w-7 items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-black shadow-md ring-2 ${teamMarkerClass(p.team)} ${
                    isDecider ? "ring-primary ring-offset-2 ring-offset-background" : "ring-background"
                  } ${isSelected ? "outline outline-2 outline-offset-1 outline-amber-400" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlacement(p.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {p.label.slice(0, 2)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
