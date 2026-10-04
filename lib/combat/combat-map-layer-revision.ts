import { parseCombatMapElements, type CombatMapLayerGroup } from "./combat-map-document.ts";

/** Sidebar-only fingerprint: layer ids, kinds, labels, groups — not geometry or paint. */
export function combatMapLayerRevision(
  svg: string,
  layerGroups: readonly CombatMapLayerGroup[] | undefined,
): string {
  const lines: string[] = [];
  for (const el of parseCombatMapElements(svg)) {
    if (el.kind === "bounding_box") continue;
    lines.push(
      `${el.id}\0${el.kind}\0${el.attrs.name?.trim() ?? ""}\0${el.attrs["sheet-id"]?.trim() ?? ""}`,
    );
  }
  lines.push(JSON.stringify(layerGroups ?? []));
  return lines.join("\n");
}
