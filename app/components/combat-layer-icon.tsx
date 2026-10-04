import { BoxSelect, DoorOpen, HelpCircle, Shield, Square, UserPlus, type LucideIcon } from "lucide-react";

import type { CombatMapElementKind } from "@/lib/combat/combat-map-document";
import { combatMapLayerIconKind, type CombatMapLayerIconKind } from "@/lib/combat/combat-map-layer-icon";

const ICONS: Record<CombatMapLayerIconKind, LucideIcon> = {
  bounds: BoxSelect,
  wall: Square,
  cover: Shield,
  room: DoorOpen,
  npc: UserPlus,
  unknown: HelpCircle,
};

export function CombatMapLayerIcon({
  kind,
  className = "size-4 shrink-0 opacity-70",
}: {
  kind: CombatMapElementKind;
  className?: string;
}) {
  const Icon = ICONS[combatMapLayerIconKind(kind)];
  return <Icon className={className} aria-hidden />;
}
