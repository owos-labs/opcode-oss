import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import {
  combatTestActorMarkerPercent,
  svgDefaultMetersPerUnit,
  type SvgViewBox,
} from "./combat-test-scene.ts";

export type CombatBenchTeam = string;

const TEAM_PALETTE_SIZE = 6;

export const TEAM_MARKER_COLORS = [
  "#be3f4b",
  "#ffa705",
  "#f59e0b",
  "#8b5cf6",
  "#0891b2",
  "#65a30d",
] as const;

export function teamColorIndex(team: string): number {
  if (team === "hostile") return 0;
  if (team === "friendly") return 1;
  let hash = 0;
  for (let i = 0; i < team.length; i++) hash = (hash * 31 + team.charCodeAt(i)) | 0;
  return 2 + (Math.abs(hash) % (TEAM_PALETTE_SIZE - 2));
}

export function teamMarkerColor(team: string): string {
  return TEAM_MARKER_COLORS[teamColorIndex(team)] ?? "#1a1a1a";
}

export function nextDefaultTeam(placements: readonly CombatMapPlacement[]): string {
  if (!placements.some((p) => p.team === "hostile")) return "hostile";
  if (!placements.some((p) => p.team === "friendly")) return "friendly";
  return `team-${placements.length + 1}`;
}

export function normalizeTeamId(team: string): string | null {
  const trimmed = team.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
  metersPerUnit?: number,
): { x: number; y: number } {
  const mpu = metersPerUnit ?? svgDefaultMetersPerUnit(viewBox.w);
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
  metersPerUnit?: number,
): { leftPct: number; topPct: number } {
  return combatTestActorMarkerPercent({ x, y }, viewBox, metersPerUnit);
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
  if (placements.length < 1) return { ok: false, reason: "need_decider" };
  if (!deciderPlacementId) return { ok: false, reason: "need_decider" };
  if (!placements.some((p) => p.id === deciderPlacementId)) {
    return { ok: false, reason: "need_decider" };
  }
  if (placements.length === 1) return { ok: true };
  const teams = new Set(placements.map((p) => p.team));
  if (teams.size < 2) return { ok: false, reason: "need_two_factions" };
  return { ok: true };
}
