import type { CombatMapElementKind } from "./combat-map-document.ts";

export type CombatMapLayerIconKind = "bounds" | "wall" | "cover" | "room" | "npc" | "unknown";

export function combatMapLayerIconKind(kind: CombatMapElementKind): CombatMapLayerIconKind {
  switch (kind) {
    case "bounding_box":
      return "bounds";
    case "barrier":
      return "wall";
    case "concealment":
      return "cover";
    case "room":
      return "room";
    case "npc_token":
      return "npc";
    default:
      return "unknown";
  }
}
