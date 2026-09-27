import type { CharacterSheet, OpcodeSheetForm } from "./characterSheet.types";
import {
  buildCreateCharacterSheetDto,
  buildUpdateCharacterSheetDto,
  calculateOpcodeSkillPointBudget,
  calculateOpcodeSkillPointsUsed,
  createOpcodeSheetForm,
  readOpcodeSheetSummary,
  sheetToOpcodeForm,
  validateOpcodeSheetForm,
} from "./opcodeSheet";
import { inventoryExportMarkdown } from "./inventory-export-md";
import {
  cloneOpcodeInventoryDraft,
  readOpcodeInventory,
  validateOpcodeInventoryDrafts,
  writeOpcodeInventory,
} from "./opcodeInventory";
import type { OpcodeInventoryDraft } from "./opcodeInventory.types";

export type SheetMode = "create" | "career";

export interface SheetInfo {
  base: {
    handle: string;
    sex: string;
    desc: string;
    appearance: string;
  };
  images: Record<string, { title: string; desc: string }>;
}

export interface ItemContainer {
  name: string;
  weight: { base: number; allows: number };
  items: string[];
}

export interface OpcodeLocalSheet extends CharacterSheet {
  mode: SheetMode;
  group: string;
  info: SheetInfo;
}

export function emptyInfo(): SheetInfo {
  return {
    base: { handle: "", sex: "", desc: "", appearance: "" },
    images: {},
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function createLocalSheet(name = ""): OpcodeLocalSheet {
  const form = createOpcodeSheetForm();
  form.name = name.trim() || "Untitled";
  const dto = buildCreateCharacterSheetDto(form);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: dto.name,
    created_at: now,
    updated_at: now,
    created_by: "local",
    character_id: null,
    rule_book: dto.rule_book,
    version: dto.version,
    mode: "create",
    group: "",
    info: emptyInfo(),
    stats: dto.stats,
    status: dto.status,
  };
}

export function normalizeLocalSheet(raw: unknown): OpcodeLocalSheet | null {
  const value = asRecord(raw);
  if (typeof value.id !== "string" || !value.id) return null;
  const infoRaw = asRecord(value.info);
  const base = asRecord(infoRaw.base);
  const images = asRecord(infoRaw.images);
  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : "",
    created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
    created_by: typeof value.created_by === "string" ? value.created_by : "local",
    character_id: typeof value.character_id === "string" ? value.character_id : null,
    rule_book: "Opcode",
    version: typeof value.version === "string" ? value.version : "1",
    mode: value.mode === "career" ? "career" : "create",
    group: typeof value.group === "string" ? value.group.trim() : "",
    info: {
      base: {
        handle: typeof base.handle === "string" ? base.handle : "",
        sex: typeof base.sex === "string" ? base.sex : "",
        desc: typeof base.desc === "string" ? base.desc : "",
        appearance: typeof base.appearance === "string" ? base.appearance : "",
      },
      images: Object.fromEntries(
        Object.entries(images).map(([id, meta]) => {
          const record = asRecord(meta);
          return [
            id,
            {
              title: typeof record.title === "string" ? record.title : "",
              desc: typeof record.desc === "string" ? record.desc : "",
            },
          ];
        }),
      ),
    },
    stats: asRecord(value.stats),
    status: asRecord(value.status),
  };
}

export function duplicateSheet(sheet: OpcodeLocalSheet): OpcodeLocalSheet {
  const copy = structuredClone(sheet);
  copy.id = crypto.randomUUID();
  copy.name = sheet.name ? `${sheet.name} copy` : "copy";
  copy.created_at = new Date().toISOString();
  copy.updated_at = copy.created_at;
  copy.mode = "create";
  return copy;
}

export function applyEditorState(
  sheet: OpcodeLocalSheet,
  form: OpcodeSheetForm,
  drafts: OpcodeInventoryDraft[],
): OpcodeLocalSheet {
  let stats = sheet.stats;
  let status = asRecord(sheet.status);
  try {
    const payload = Object.keys(sheet.stats).length
      ? buildUpdateCharacterSheetDto(form, sheet)
      : buildCreateCharacterSheetDto(form);
    stats = payload.stats ?? stats;
    status = asRecord(payload.status ?? status);
  } catch {
    // ponytail: persist info/inventory even while the form is still invalid
  }
  try {
    status.inventory = writeOpcodeInventory(drafts);
  } catch {
    // keep last valid inventory wire
  }
  if (!isPlain(status.containers))
    status.containers = asRecord(sheet.status).containers ?? {};
  return {
    ...sheet,
    name: form.name.trim() || sheet.name,
    character_id: form.characterId.trim() || null,
    version: form.version.trim() || sheet.version,
    updated_at: new Date().toISOString(),
    stats,
    status,
  };
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readContainers(status: Record<string, unknown>): Record<string, ItemContainer> {
  const source = asRecord(status.containers);
  const next: Record<string, ItemContainer> = {};
  for (const [id, value] of Object.entries(source)) {
    const record = asRecord(value);
    const weight = asRecord(record.weight);
    next[id] = {
      name: typeof record.name === "string" ? record.name : "",
      weight: {
        base: typeof weight.base === "number" ? weight.base : Number(weight.base) || 0,
        allows: typeof weight.allows === "number" ? weight.allows : Number(weight.allows) || 0,
      },
      items: Array.isArray(record.items)
        ? record.items.filter((item): item is string => typeof item === "string")
        : [],
    };
  }
  return next;
}

export function writeContainers(
  status: Record<string, unknown>,
  containers: Record<string, ItemContainer>,
): Record<string, unknown> {
  return { ...status, containers };
}

export function moveContainerItem(
  containers: Record<string, ItemContainer>,
  itemId: string,
  toId: string | null,
  beforeId?: string,
): Record<string, ItemContainer> {
  const next = Object.fromEntries(
    Object.entries(containers).map(([id, container]) => [
      id,
      { ...container, items: container.items.filter((item) => item !== itemId) },
    ]),
  );
  if (toId && next[toId]) {
    const items = [...next[toId].items];
    const at = beforeId ? items.indexOf(beforeId) : -1;
    items.splice(at < 0 ? items.length : at, 0, itemId);
    next[toId] = { ...next[toId], items };
  }
  return next;
}

export function placeContainerItem(
  containers: Record<string, ItemContainer>,
  itemId: string,
  toId: string | null,
  beforeId?: string,
): Record<string, ItemContainer> {
  return moveContainerItem(containers, itemId, toId, beforeId);
}

export function effectiveCarryKilograms(maxCarry: number, containers: Record<string, ItemContainer>) {
  const extra = Object.values(containers).reduce((sum, container) => sum + (Number(container.weight.allows) || 0), 0);
  return (Number(maxCarry) || 0) + extra;
}

export function carriedKilograms(
  drafts: { count: string; weight?: string; weapon?: { weight: string } }[],
  containers: Record<string, ItemContainer>,
) {
  const items = drafts.reduce((sum, draft) => {
    const each = Number(draft.weapon ? draft.weapon.weight : draft.weight);
    if (!Number.isFinite(each)) return sum;
    const count = Number(draft.count);
    return sum + each * (Number.isFinite(count) ? count : 0);
  }, 0);
  const bags = Object.values(containers).reduce((sum, container) => sum + (Number(container.weight.base) || 0), 0);
  return items + bags;
}

export function groupItems(
  containers: Record<string, ItemContainer>,
  itemIds: string[],
  name: string,
  id = crypto.randomUUID(),
  allows = 0,
): Record<string, ItemContainer> {
  let next = containers;
  for (const itemId of itemIds) next = placeContainerItem(next, itemId, null);
  return {
    ...next,
    [id]: { name, weight: { base: 0, allows }, items: [...itemIds] },
  };
}

export function dissolveContainer(
  containers: Record<string, ItemContainer>,
  id: string,
): Record<string, ItemContainer> {
  if (!containers[id]) return containers;
  const next = { ...containers };
  delete next[id];
  return next;
}

export function duplicateInventoryItem(
  drafts: OpcodeInventoryDraft[],
  containers: Record<string, ItemContainer>,
  id: string,
): { drafts: OpcodeInventoryDraft[]; containers: Record<string, ItemContainer> } | null {
  const index = drafts.findIndex((draft) => draft.id === id);
  if (index < 0) return null;
  const copy = cloneOpcodeInventoryDraft(drafts[index]);
  copy.id = crypto.randomUUID();
  copy.clientKey = crypto.randomUUID();
  const nextDrafts = drafts.slice();
  nextDrafts.splice(index + 1, 0, copy);
  let nextContainers = containers;
  for (const [containerId, container] of Object.entries(containers)) {
    const at = container.items.indexOf(id);
    if (at < 0) continue;
    const items = container.items.slice();
    items.splice(at + 1, 0, copy.id);
    nextContainers = { ...containers, [containerId]: { ...container, items } };
    break;
  }
  return { drafts: nextDrafts, containers: nextContainers };
}

export function reorderContainerItem(
  containers: Record<string, ItemContainer>,
  itemId: string,
  delta: number,
): Record<string, ItemContainer> {
  for (const [id, container] of Object.entries(containers)) {
    const index = container.items.indexOf(itemId);
    if (index < 0) continue;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= container.items.length) return containers;
    const items = [...container.items];
    const [moved] = items.splice(index, 1);
    items.splice(nextIndex, 0, moved);
    return { ...containers, [id]: { ...container, items } };
  }
  return containers;
}

export function careerCompliance(
  form: OpcodeSheetForm,
  drafts: OpcodeInventoryDraft[],
): Record<string, string> {
  const errors = { ...validateOpcodeSheetForm(form), ...validateOpcodeInventoryDrafts(drafts) };
  const budget = calculateOpcodeSkillPointBudget(form.skillPointMode, form.baseStats);
  const used = calculateOpcodeSkillPointsUsed(form.skills);
  if (used > budget.budget)
    errors.skillPoints = "characterSheets.skills.budgetRemaining";
  return errors;
}

export function sheetListLabel(sheet: OpcodeLocalSheet) {
  return sheet.name.trim() || sheet.info.base.handle.trim() || sheet.id.slice(0, 8);
}

export function toMarkdown(sheet: OpcodeLocalSheet, form: OpcodeSheetForm, drafts: OpcodeInventoryDraft[]) {
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const stats = OPCODE_LINE(form);
  const derived = [
    `- MOV: ${summary.mov}`,
    `- Carry: ${summary.weight} kg`,
    `- Senses (A/V/S): ${summary.sensA} / ${summary.sensV} / ${summary.sensS}`,
    `- HP (${summary.healthMode ?? form.healthMode}): ${summary.maxHealth}${summary.currentHealth == null ? "" : ` (current ${summary.currentHealth})`}`,
  ].join("\n");
  const partHp =
    summary.healthMode === "normal"
      ? summary.parts
          .map((part) => `- ${part.key}: ${part.max}${part.current == null ? "" : ` / ${part.current}`}`)
          .join("\n")
      : "";
  const skills = form.skills
    .filter((skill) => Number(skill.value) > 0 || skill.specializations?.length)
    .map((skill) => {
      const specs = (skill.specializations || [])
        .filter((spec) => spec.name.trim())
        .map((spec) => `  - ${spec.name}: ${spec.value}`)
        .join("\n");
      return `- ${skill.name}: ${skill.value}${specs ? `\n${specs}` : ""}`;
    })
    .join("\n");
  const containers = readContainers(sheet.status);
  const gear = inventoryExportMarkdown(drafts, containers);
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const containerLines = Object.entries(containers)
    .map(([id, container]) => {
      const names = container.items.map((itemId) => byId.get(itemId)?.name.trim() || itemId);
      return `- ${container.name || id}: ${names.join(", ") || "_empty_"} (+${container.weight.allows} kg)`;
    })
    .join("\n");
  return [
    `# ${sheet.name || "Untitled"}`,
    "",
    `- id: ${sheet.id}`,
    `- handle: ${sheet.info.base.handle}`,
    `- mode: ${sheet.mode}`,
    `- group: ${sheet.group || "—"}`,
    `- sex: ${sheet.info.base.sex}`,
    `- version: ${sheet.version}`,
    `- rule_book: ${sheet.rule_book}`,
    `- character_id: ${sheet.character_id ?? "—"}`,
    `- skill_points: ${summary.skillPointsUsed}/${summary.skillPointsBudget} (${form.skillPointMode})`,
    "",
    "## Appearance",
    sheet.info.base.appearance || "",
    "",
    "## Description",
    sheet.info.base.desc || "",
    "",
    "## Attributes",
    stats,
    "",
    "## Derived",
    derived,
    partHp ? `\n${partHp}` : "",
    "",
    "## Skills",
    skills || "_none_",
    "",
    "## Equipment",
    gear,
    "",
    "## Containers",
    containerLines || "_none_",
  ].join("\n");
}

function OPCODE_LINE(form: OpcodeSheetForm) {
  return Object.entries(form.baseStats)
    .map(([key, value]) => `- ${key.toUpperCase()}: ${value}`)
    .join("\n");
}

export function parseImportedSheet(text: string): OpcodeLocalSheet | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return normalizeLocalSheet(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  const heading = trimmed.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  const sheet = createLocalSheet(heading);
  const appearance = trimmed.split("## Appearance")[1]?.split("##")[0]?.trim();
  const desc = trimmed.split("## Description")[1]?.split("##")[0]?.trim();
  if (appearance) sheet.info.base.appearance = appearance;
  if (desc) sheet.info.base.desc = desc;
  return sheet;
}

export { sheetToOpcodeForm, createOpcodeSheetForm, readOpcodeInventory };
