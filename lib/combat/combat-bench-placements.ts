import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import {
  combatTestActorMarkerPercent,
  svgDefaultMetersPerUnit,
  type SvgViewBox,
} from "./combat-test-scene.ts";

export type CombatBenchTeam = "friendly" | "hostile";

export type CombatMapPlacement = {
  id: string;
  sheetId: string;
  label: string;
  x: number;
  y: number;
  team: CombatBenchTeam;
  profileId?: NpcDifficultyId;
};

export function svgPercentToMeterPosition(
  leftPct: number,
  topPct: number,
  viewBox: SvgViewBox,
): { x: number; y: number } {
  const mpu = svgDefaultMetersPerUnit(viewBox.w);
  const sx = viewBox.x + (leftPct / 100) * viewBox.w;
  const sy = viewBox.y + (topPct / 100) * viewBox.h;
  return {
    x: (sx - viewBox.x) * mpu,
    y: (sy - viewBox.y) * mpu,
  };
}

export function dropPointFromClientOffset(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { leftPct: number; topPct: number } {
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  return {
    leftPct: rect.width > 0 ? (x / rect.width) * 100 : 0,
    topPct: rect.height > 0 ? (y / rect.height) * 100 : 0,
  };
}

export function meterPositionToMarkerPercent(
  x: number,
  y: number,
  viewBox: SvgViewBox,
): { leftPct: number; topPct: number } {
  return combatTestActorMarkerPercent({ x, y }, viewBox);
}

export function defaultDeciderPlacementId(placements: readonly CombatMapPlacement[]): string | null {
  const hostile = placements.find((p) => p.team === "hostile");
  if (hostile) return hostile.id;
  return placements[0]?.id ?? null;
}

export function benchStartValidation(
  placements: readonly CombatMapPlacement[],
  deciderPlacementId: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (placements.length < 2) return { ok: false, reason: "need_two_units" };
  if (!deciderPlacementId) return { ok: false, reason: "need_decider" };
  if (!placements.some((p) => p.id === deciderPlacementId)) {
    return { ok: false, reason: "need_decider" };
  }
  const others = placements.filter((p) => p.id !== deciderPlacementId);
  if (others.length < 1) return { ok: false, reason: "need_target" };
  return { ok: true };
}
