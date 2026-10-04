export type CombatMapEditorHelpEntry = {
  id: string;
  labelKey: string;
  shortcut?: string;
};

export const COMBAT_MAP_EDITOR_HELP_ENTRIES: CombatMapEditorHelpEntry[] = [
  { id: "draw", labelKey: "combat.editor.help.draw" },
  { id: "pan", labelKey: "combat.editor.help.pan", shortcut: "Space + drag" },
  { id: "zoom", labelKey: "combat.editor.help.zoom", shortcut: "Wheel" },
  { id: "multiSelect", labelKey: "combat.editor.help.multiSelect", shortcut: "Shift + click" },
  { id: "marquee", labelKey: "combat.editor.help.marquee", shortcut: "Ctrl + drag" },
  { id: "center", labelKey: "combat.editor.help.center", shortcut: "Double-click" },
  { id: "copy", labelKey: "combat.editor.help.copy", shortcut: "Ctrl+C" },
  { id: "paste", labelKey: "combat.editor.help.paste", shortcut: "Ctrl+V" },
  { id: "undo", labelKey: "combat.editor.help.undo", shortcut: "Ctrl+Z" },
  { id: "redo", labelKey: "combat.editor.help.redo", shortcut: "Ctrl+Shift+Z" },
  { id: "group", labelKey: "combat.editor.help.group", shortcut: "Ctrl+G" },
  { id: "ungroup", labelKey: "combat.editor.help.ungroup", shortcut: "Ctrl+Backspace" },
  { id: "delete", labelKey: "combat.editor.help.delete", shortcut: "Delete" },
  { id: "rename", labelKey: "combat.editor.help.rename", shortcut: "Double-click layer" },
];
