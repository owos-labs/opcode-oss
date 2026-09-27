export type ModalShortcutAction = "cancel" | "confirm";

export function modalShortcutAction(
  key: string,
  target: EventTarget | null,
  options: { confirmDisabled?: boolean; enterFromInputs?: boolean } = {},
): ModalShortcutAction | null {
  if (key === "Escape") return "cancel";
  if (key === "Enter" && !options.confirmDisabled) {
    if (
      !options.enterFromInputs &&
      target !== null &&
      typeof target === "object" &&
      "closest" in target &&
      typeof (target as { closest: (sel: string) => unknown }).closest === "function" &&
      (target as { closest: (sel: string) => unknown }).closest("input, textarea, select, [contenteditable=true]")
    ) {
      return null;
    }
    return "confirm";
  }
  return null;
}
