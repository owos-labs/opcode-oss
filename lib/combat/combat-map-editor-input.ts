export function isCombatMapTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!(
    el?.closest("input, textarea, select, [contenteditable='true']") ||
    el?.closest('[role="dialog"]')
  );
}

export function isSpacePanKeyDown(
  event: Pick<KeyboardEvent, "code" | "repeat">,
  typing: boolean,
): boolean {
  return event.code === "Space" && !event.repeat && !typing;
}

export type CombatDrawTool = "bounding_box" | "barrier" | "concealment" | "room";

export function isCombatDrawTool(tool: string): tool is CombatDrawTool {
  return tool === "bounding_box" || tool === "barrier" || tool === "concealment" || tool === "room";
}

export function combatDrawToolActive(tool: string, spacePanHeld: boolean): boolean {
  return isCombatDrawTool(tool) && !spacePanHeld;
}

/** Minimum drawn rect edge in meters (walls can be thin). */
export function minCombatDrawRectSizeM(kind: CombatDrawTool): number {
  if (kind === "barrier" || kind === "concealment") return 0.05;
  return 0.1;
}

export function minCombatDrawRectSizeSvg(metersPerUnit: number, kind: CombatDrawTool): number {
  return minCombatDrawRectSizeM(kind) / metersPerUnit;
}

export function isCombatDrawRectLargeEnough(
  widthSvg: number,
  heightSvg: number,
  metersPerUnit: number,
  kind: CombatDrawTool,
): boolean {
  const min = minCombatDrawRectSizeSvg(metersPerUnit, kind);
  const eps = 1e-6;
  return widthSvg + eps >= min && heightSvg + eps >= min;
}

export function gridSnapEnabledForElementKind(kind: string | undefined): boolean {
  return kind !== "barrier" && kind !== "concealment";
}

export function isCombatMapClipboardKeyDown(
  event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey">,
  typing: boolean,
): "copy" | "paste" | null {
  if (typing || (!event.ctrlKey && !event.metaKey)) return null;
  if (event.code === "KeyC") return "copy";
  if (event.code === "KeyV") return "paste";
  return null;
}

export function isCombatMapEscapeKeyDown(
  event: Pick<KeyboardEvent, "code">,
  typing: boolean,
): boolean {
  return event.code === "Escape" && !typing;
}

export function isMarqueeSelectModifier(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey">,
): boolean {
  return event.ctrlKey || event.metaKey;
}

export function isCombatMapUndoKeyDown(
  event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey">,
  typing: boolean,
): "undo" | "redo" | null {
  if (typing || (!event.ctrlKey && !event.metaKey)) return null;
  if (event.code !== "KeyZ") return null;
  return event.shiftKey ? "redo" : "undo";
}

export function isCombatMapGroupKeyDown(
  event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
  typing: boolean,
): boolean {
  return !typing && (event.ctrlKey || event.metaKey) && event.code === "KeyG" && !event.shiftKey && !event.altKey;
}

export function isCombatMapUngroupKeyDown(
  event: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "key">,
  typing: boolean,
): boolean {
  return !typing && (event.ctrlKey || event.metaKey) && (event.code === "Backspace" || event.key === "Backspace");
}

export function isCombatMapHelpKeyDown(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  typing: boolean,
): boolean {
  return !typing && event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey;
}
