import type { CombatMapElement } from "./combat-map-document.ts";

export const COMBAT_MAP_SHARED_MIXED = "__mixed__";

export function sharedElementAttr(
  elements: readonly CombatMapElement[],
  key: string,
  read?: (el: CombatMapElement) => string,
): string | typeof COMBAT_MAP_SHARED_MIXED | undefined {
  if (elements.length === 0) return undefined;
  let shared: string | undefined;
  for (const el of elements) {
    const value = read ? read(el) : (el.attrs[key] ?? "");
    if (shared === undefined) shared = value;
    else if (shared !== value) return COMBAT_MAP_SHARED_MIXED;
  }
  return shared ?? "";
}

export function sharedWallLikeKeys(elements: readonly CombatMapElement[]): boolean {
  return elements.length > 0 && elements.every((el) => el.kind === "barrier" || el.kind === "concealment");
}

export function sharedRoomSelection(elements: readonly CombatMapElement[]): boolean {
  return elements.length > 0 && elements.every((el) => el.kind === "room");
}

export function sharedConcealmentSelection(elements: readonly CombatMapElement[]): boolean {
  return elements.length > 0 && elements.every((el) => el.kind === "concealment");
}

export function sharedBarrierSelection(elements: readonly CombatMapElement[]): boolean {
  return elements.length > 0 && elements.every((el) => el.kind === "barrier");
}

export function displaySharedAttr(
  value: string | typeof COMBAT_MAP_SHARED_MIXED | undefined,
): string {
  if (value === COMBAT_MAP_SHARED_MIXED) return "";
  return value ?? "";
}

export function sharedAttrPlaceholder(
  value: string | typeof COMBAT_MAP_SHARED_MIXED | undefined,
): string | undefined {
  return value === COMBAT_MAP_SHARED_MIXED ? "—" : undefined;
}
