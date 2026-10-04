import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import type { CombatMapElement } from "./combat-map-document.ts";
import { combatMapElementCenter } from "./combat-map-element-geometry.ts";
import { svgUnitsToMeters } from "./combat-map-units.ts";
import { parseSvgViewBox } from "./combat-test-scene.ts";

export function combatMapNpcPlacements(
  elements: readonly CombatMapElement[],
  svg: string,
  metersPerUnit: number,
  labelForSheet: (sheetId: string, elementId: string) => string,
): CombatMapPlacement[] {
  const viewBox = parseSvgViewBox(svg);
  if (!viewBox) return [];
  const out: CombatMapPlacement[] = [];
  for (const el of elements) {
    if (el.kind !== "npc_token") continue;
    const center = combatMapElementCenter(el);
    const sheetId = el.attrs["sheet-id"]?.trim() ?? "";
    if (!center || !sheetId) continue;
    out.push({
      id: el.id,
      sheetId,
      label: labelForSheet(sheetId, el.id),
      x: svgUnitsToMeters(center.x - viewBox.x, metersPerUnit),
      y: svgUnitsToMeters(center.y - viewBox.y, metersPerUnit),
      team: el.attrs.team?.trim() || "friendly",
      profileId: (el.attrs["ai-difficulty"] ?? "trained") as NpcDifficultyId,
    });
  }
  return out;
}
