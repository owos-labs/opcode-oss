import {
  combatTestActorSvgUserPoint,
  svgDefaultMetersPerUnit,
  type SvgViewBox,
} from "./combat-test-scene.ts";

export function metersToSvgPoint(
  x: number,
  y: number,
  viewBox: SvgViewBox,
  metersPerUnit?: number,
): { x: number; y: number } {
  return combatTestActorSvgUserPoint({ x, y }, viewBox, metersPerUnit);
}

export function meterPolylineSvgPoints(
  points: readonly { x: number; y: number }[],
  viewBox: SvgViewBox,
  metersPerUnit?: number,
): string {
  return points
    .map((p) => {
      const s = metersToSvgPoint(p.x, p.y, viewBox, metersPerUnit);
      return `${s.x},${s.y}`;
    })
    .join(" ");
}

export function meterRadiusSvg(
  radiusM: number,
  viewBox: SvgViewBox,
  metersPerUnit?: number,
): number {
  const mpu = metersPerUnit ?? svgDefaultMetersPerUnit(viewBox.w);
  return radiusM / Math.max(mpu, 1e-9);
}
