import type { CombatMapElement } from "./combat-map-document.ts";

export type CombatMapLayerGroup = {
  id: string;
  name: string;
  memberIds: string[];
};

export type CombatMapLayerRow =
  | { kind: "layer"; id: string }
  | { kind: "group"; id: string; name: string; memberIds: string[] };

export function normalizeCombatMapLayerGroups(raw: unknown): CombatMapLayerGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: CombatMapLayerGroup[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string" || !Array.isArray(o.memberIds)) continue;
    const memberIds = o.memberIds.filter((id): id is string => typeof id === "string");
    if (memberIds.length === 0) continue;
    out.push({ id: o.id, name: o.name, memberIds });
  }
  return out;
}

export function nextCombatMapLayerGroupId(_groups: readonly CombatMapLayerGroup[]): string {
  return crypto.randomUUID();
}

export function nextCombatMapLayerGroupName(groups: readonly CombatMapLayerGroup[]): string {
  let n = 1;
  const used = new Set(groups.map((group) => group.name));
  while (used.has(`Group ${n}`)) n += 1;
  return `Group ${n}`;
}

export function stripMembersFromGroups(
  groups: readonly CombatMapLayerGroup[],
  memberIds: readonly string[],
): CombatMapLayerGroup[] {
  const remove = new Set(memberIds);
  return groups
    .map((group) => ({ ...group, memberIds: group.memberIds.filter((id) => !remove.has(id)) }))
    .filter((group) => group.memberIds.length > 0);
}

export function createLayerGroupFromSelection(
  groups: readonly CombatMapLayerGroup[],
  selectedIds: readonly string[],
  elements: readonly CombatMapElement[],
  name?: string,
): { groups: CombatMapLayerGroup[]; groupId: string } | null {
  const allowed = new Set(
    elements.filter((el) => el.kind !== "bounding_box").map((el) => el.id),
  );
  const memberIds = selectedIds.filter((id) => allowed.has(id));
  if (memberIds.length < 2) return null;
  const id = nextCombatMapLayerGroupId(groups);
  const nextGroup: CombatMapLayerGroup = {
    id,
    name: name?.trim() || nextCombatMapLayerGroupName(groups),
    memberIds,
  };
  return {
    groups: [...stripMembersFromGroups(groups, memberIds), nextGroup],
    groupId: id,
  };
}

export function ungroupSelectedLayers(
  groups: readonly CombatMapLayerGroup[],
  selectedIds: readonly string[],
): CombatMapLayerGroup[] {
  return stripMembersFromGroups(groups, selectedIds);
}

export function removeLayerFromGroups(
  groups: readonly CombatMapLayerGroup[],
  memberId: string,
): CombatMapLayerGroup[] {
  return stripMembersFromGroups(groups, [memberId]);
}

export function renameLayerGroup(
  groups: readonly CombatMapLayerGroup[],
  groupId: string,
  name: string,
): CombatMapLayerGroup[] {
  const trimmed = name.trim();
  if (!trimmed) return [...groups];
  return groups.map((group) => (group.id === groupId ? { ...group, name: trimmed } : group));
}

export function buildCombatMapLayerRows(
  elements: readonly CombatMapElement[],
  groups: readonly CombatMapLayerGroup[],
): CombatMapLayerRow[] {
  const memberToGroup = new Map<string, CombatMapLayerGroup>();
  for (const group of groups) {
    for (const id of group.memberIds) memberToGroup.set(id, group);
  }
  const shownGroups = new Set<string>();
  const rows: CombatMapLayerRow[] = [];
  for (const el of elements) {
    const group = memberToGroup.get(el.id);
    if (group) {
      if (!shownGroups.has(group.id)) {
        shownGroups.add(group.id);
        rows.push({
          kind: "group",
          id: group.id,
          name: group.name,
          memberIds: group.memberIds.filter((id) => elements.some((entry) => entry.id === id)),
        });
      }
      continue;
    }
    rows.push({ kind: "layer", id: el.id });
  }
  return rows;
}

export function groupMemberIds(group: CombatMapLayerGroup): string[] {
  return [...group.memberIds];
}
