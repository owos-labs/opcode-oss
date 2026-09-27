export function characterSheetId(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "character-sheet" ? parts[1] : undefined;
}

export function sidebarShowsCharacterList(pathname: string) {
  return characterSheetId(pathname) === undefined;
}

export function characterSidebar(pathname: string) {
  return sidebarShowsCharacterList(pathname) ? ("list" as const) : ("section" as const);
}

export function sidebarMotionKey(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "character-sheet") return "/character-sheet";
  if (parts[0] === "combat") return "/combat";
  return pathname;
}

