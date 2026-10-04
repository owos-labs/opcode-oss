export type CombatMapEditorHelpEntry = {
  id: string;
  labelKey: string;
  shortcutKey?: string;
};

export const COMBAT_MAP_EDITOR_HELP_ENTRIES: CombatMapEditorHelpEntry[] = [
  { id: "draw", labelKey: "combat.editor.help.draw" },
  { id: "pan", labelKey: "combat.editor.help.pan", shortcutKey: "combat.editor.help.shortcut.pan" },
  { id: "zoom", labelKey: "combat.editor.help.zoom", shortcutKey: "combat.editor.help.shortcut.zoom" },
  {
    id: "multiSelect",
    labelKey: "combat.editor.help.multiSelect",
    shortcutKey: "combat.editor.help.shortcut.multiSelect",
  },
  { id: "marquee", labelKey: "combat.editor.help.marquee", shortcutKey: "combat.editor.help.shortcut.marquee" },
  { id: "center", labelKey: "combat.editor.help.center", shortcutKey: "combat.editor.help.shortcut.center" },
  { id: "copy", labelKey: "combat.editor.help.copy", shortcutKey: "combat.editor.help.shortcut.copy" },
  { id: "paste", labelKey: "combat.editor.help.paste", shortcutKey: "combat.editor.help.shortcut.paste" },
  { id: "undo", labelKey: "combat.editor.help.undo", shortcutKey: "combat.editor.help.shortcut.undo" },
  { id: "redo", labelKey: "combat.editor.help.redo", shortcutKey: "combat.editor.help.shortcut.redo" },
  { id: "group", labelKey: "combat.editor.help.group", shortcutKey: "combat.editor.help.shortcut.group" },
  { id: "ungroup", labelKey: "combat.editor.help.ungroup", shortcutKey: "combat.editor.help.shortcut.ungroup" },
  { id: "delete", labelKey: "combat.editor.help.delete", shortcutKey: "combat.editor.help.shortcut.delete" },
  { id: "rename", labelKey: "combat.editor.help.rename", shortcutKey: "combat.editor.help.shortcut.rename" },
];
