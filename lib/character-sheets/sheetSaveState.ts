export type SheetSaveState = "saved" | "saving" | "unsaved" | "error";

/** Autosave off while dirty used to leave status stuck on "saving". */
export function reconcileSaveStateAfterAutosaveOff(
  dirty: boolean,
  saveState: SheetSaveState,
): SheetSaveState {
  if (dirty && saveState === "saving") return "unsaved";
  return saveState;
}
