"use client";

import type { CombatBenchCoverMark } from "@/lib/combat/combat-bench-map-graphics";
import { teamMarkerColor } from "@/lib/combat/combat-bench-placements";
import { meterPolylineSvgPoints, metersToSvgPoint } from "@/lib/combat/combat-map-meter-svg";
import type { SvgViewBox } from "@/lib/combat/combat-test-scene";

export function CombatMapFovOverlay({
  viewBox,
  metersPerUnit,
  polygon,
  team = "friendly",
  strokeWidth = 0.0012,
}: {
  viewBox: SvgViewBox;
  metersPerUnit: number;
  polygon: readonly { x: number; y: number }[];
  team?: string;
  strokeWidth?: number;
}) {
  if (polygon.length < 3) return null;
  const color = teamMarkerColor(team);
  const sw = viewBox.w * strokeWidth;
  return (
    <polygon
      points={meterPolylineSvgPoints(polygon, viewBox, metersPerUnit)}
      fill={color}
      fillOpacity={0.1}
      stroke={color}
      strokeOpacity={0.45}
      strokeWidth={sw}
    />
  );
}

export function CombatMapMovementOverlay({
  viewBox,
  metersPerUnit,
  disk,
  strokeWidth = 0.0015,
}: {
  viewBox: SvgViewBox;
  metersPerUnit: number;
  disk: readonly { x: number; y: number }[];
  strokeWidth?: number;
}) {
  if (disk.length < 3) return null;
  const sw = viewBox.w * strokeWidth;
  return (
    <polygon
      points={meterPolylineSvgPoints(disk, viewBox, metersPerUnit)}
      fill="rgb(34 197 94 / 0.2)"
      stroke="rgb(22 163 74 / 0.55)"
      strokeWidth={sw}
    />
  );
}

export function CombatMapCoverOverlay({
  viewBox,
  metersPerUnit,
  marks,
  strokeWidth = 0.0028,
}: {
  viewBox: SvgViewBox;
  metersPerUnit: number;
  marks: readonly CombatBenchCoverMark[];
  strokeWidth?: number;
}) {
  if (marks.length === 0) return null;
  return (
    <>
      {marks.map((mark) => {
        const a = metersToSvgPoint(mark.a.x, mark.a.y, viewBox, metersPerUnit);
        const b = metersToSvgPoint(mark.b.x, mark.b.y, viewBox, metersPerUnit);
        const from = metersToSvgPoint(mark.from.x, mark.from.y, viewBox, metersPerUnit);
        const to = metersToSvgPoint(mark.to.x, mark.to.y, viewBox, metersPerUnit);
        const stroke = teamMarkerColor(mark.team);
        const entered = mark.kind === "entered";
        const sw = viewBox.w * (entered ? strokeWidth * 1.5 : strokeWidth);
        return (
          <g key={`cover-${mark.placementId}-${mark.coverId}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={sw}
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
    </>
  );
}

export function CombatMapPlayOverlays({
  viewBox,
  metersPerUnit,
  team,
  fovPolygon,
  movementDisk,
  coverMarks,
  showFov,
  showPath,
  showCover,
}: {
  viewBox: SvgViewBox;
  metersPerUnit: number;
  team?: string;
  fovPolygon?: readonly { x: number; y: number }[] | null;
  movementDisk?: readonly { x: number; y: number }[] | null;
  coverMarks?: readonly CombatBenchCoverMark[] | null;
  showFov: boolean;
  showPath: boolean;
  showCover: boolean;
}) {
  const hasFov = showFov && (fovPolygon?.length ?? 0) >= 3;
  const hasPath = showPath && (movementDisk?.length ?? 0) >= 3;
  const hasCover = showCover && (coverMarks?.length ?? 0) > 0;
  if (!hasFov && !hasPath && !hasCover) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] size-full"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      aria-hidden
    >
      {hasFov ? (
        <CombatMapFovOverlay
          viewBox={viewBox}
          metersPerUnit={metersPerUnit}
          polygon={fovPolygon!}
          team={team}
        />
      ) : null}
      {hasPath ? (
        <CombatMapMovementOverlay
          viewBox={viewBox}
          metersPerUnit={metersPerUnit}
          disk={movementDisk!}
        />
      ) : null}
      {hasCover ? (
        <CombatMapCoverOverlay
          viewBox={viewBox}
          metersPerUnit={metersPerUnit}
          marks={coverMarks!}
        />
      ) : null}
    </svg>
  );
}
