export function characterSheetId(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "character-sheet" ? parts[1] : undefined;
}

export function combatMapId(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "combat" || !parts[1] || parts[1] === "test") return undefined;
  return parts[1];
}

export function sidebarShowsCharacterList(pathname: string) {
  return characterSheetId(pathname) === undefined;
}

export function characterSidebar(pathname: string) {
  return sidebarShowsCharacterList(pathname) ? ("list" as const) : ("section" as const);
}

const SHEET_SECTIONS = ["basics", "attributes", "inventory", "presets"] as const;

export type CharacterSheetSection = (typeof SHEET_SECTIONS)[number];

export function characterSheetSection(pathname: string): CharacterSheetSection {
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[2];
  return SHEET_SECTIONS.includes(section as CharacterSheetSection) ? section as CharacterSheetSection : "basics";
}

export function sidebarMotionKey(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "character-sheet") return "/character-sheet";
  if (parts[0] === "combat") return "/combat";
  return pathname;
}

