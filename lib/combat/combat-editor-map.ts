import { combatMapElementIdAfterUpdate } from "./combat-map-element-id.ts";
import {
  canDeleteCombatMapElement,
  parseCombatMapElements,
  pruneCombatMapLayerGroups,
  removeCombatMapElement,
  removeCombatMapLayerFromGroups,
  type CombatMapDocument,
} from "./combat-map-document.ts";

export function deleteCombatMapLayer(
  map: CombatMapDocument,
  id: string,
): CombatMapDocument | null {
  const el = parseCombatMapElements(map.svg).find((entry) => entry.id === id);
  if (!el || !canDeleteCombatMapElement(el)) return null;
  const svg = removeCombatMapElement(map.svg, id);
  return {
    ...map,
    svg,
    layerGroups: pruneCombatMapLayerGroups(svg, removeCombatMapLayerFromGroups(map.layerGroups, id)),
  };
}

export function renameCombatMapLayer(
  map: CombatMapDocument,
  id: string,
  name: string,
): { map: CombatMapDocument; id: string } {
  const { svg, id: nextId } = combatMapElementIdAfterUpdate(map.svg, id, { name });
  return { map: { ...map, svg }, id: nextId };
}

export function setCombatMapLayerGroups(
  map: CombatMapDocument,
  layerGroups: NonNullable<CombatMapDocument["layerGroups"]>,
): CombatMapDocument {
  return { ...map, layerGroups: pruneCombatMapLayerGroups(map.svg, layerGroups) };
}
