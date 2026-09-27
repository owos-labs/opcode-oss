import type { OpcodeSheetForm } from "./characterSheet.types";
import type { OpcodeInventoryDraft } from "./opcodeInventory.types";
import { careerCompliance } from "./model";

export type ComplianceErrorLine = {
  id: string;
  messageKey: string;
  sectionKey: string;
  fieldKey?: string;
  fieldFallback?: string;
  itemIndex?: number;
  itemKind?: OpcodeInventoryDraft["kind"];
  itemLabel?: string;
  skillLabel?: string;
};

const INVENTORY_SUFFIX_FIELDS: Record<string, string> = {
  name: "characterSheets.inventory.fields.name",
  count: "characterSheets.inventory.fields.count",
  desc: "characterSheets.inventory.fields.desc",
  weight: "inventory.itemWeight",
  "weapon.caliber": "characterSheets.inventory.fields.caliber",
  "weapon.range": "characterSheets.inventory.weapon.range",
  "weapon.rof": "characterSheets.inventory.weapon.rof",
  "weapon.accuracy": "characterSheets.inventory.weapon.accuracy",
  "weapon.concealability": "characterSheets.inventory.weapon.concealability",
  "weapon.reliability": "characterSheets.inventory.weapon.reliability",
  "weapon.type": "characterSheets.inventory.weapon.weaponType",
  "weapon.magazine": "characterSheets.inventory.weapon.magazine",
  "ammo.caliber": "characterSheets.inventory.fields.caliber",
  "magazine.caliber": "characterSheets.inventory.fields.caliber",
  "magazine.capacity": "characterSheets.inventory.magazine.capacity",
};

const TOP_FIELDS: Record<string, string> = {
  name: "characterSheets.fields.name",
  version: "characterSheets.fields.version",
  characterId: "characterSheets.fields.character",
};

export function listCareerComplianceErrors(
  form: OpcodeSheetForm,
  drafts: OpcodeInventoryDraft[],
): ComplianceErrorLine[] {
  const errors = careerCompliance(form, drafts);
  return Object.entries(errors).map(([path, messageKey]) => ({
    id: path,
    messageKey,
    ...parseCompliancePath(path, form, drafts),
  }));
}

function parseCompliancePath(
  path: string,
  form: OpcodeSheetForm,
  drafts: OpcodeInventoryDraft[],
): Omit<ComplianceErrorLine, "id" | "messageKey"> {
  if (path === "skillPoints") {
    return { sectionKey: "sheet.attributes" };
  }

  const topField = TOP_FIELDS[path];
  if (topField) {
    return { sectionKey: "sheet.basics", fieldKey: topField };
  }

  const statMatch = path.match(/^baseStats\.(\w+)$/);
  if (statMatch) {
    return {
      sectionKey: "sheet.attributes",
      fieldKey: `characterSheets.stats.${statMatch[1]}`,
    };
  }

  const skillMatch = path.match(/^skills\.(\d+)(?:\.(.+))?$/);
  if (skillMatch) {
    const index = Number(skillMatch[1]);
    const skill = form.skills[index];
    const tail = skillMatch[2] ?? "";
    const fieldKey = fieldKeyForSkillTail(tail);
    return {
      sectionKey: "sheet.attributes",
      skillLabel: skill?.name.trim() || undefined,
      fieldKey,
      fieldFallback: fieldKey ? undefined : humanizeTail(tail),
    };
  }

  const inventoryMatch = path.match(/^inventory\.(\d+)(?:\.(.+))?$/);
  if (inventoryMatch) {
    const index = Number(inventoryMatch[1]);
    const draft = drafts[index];
    const tail = inventoryMatch[2] ?? "";
    const fieldKey = fieldKeyForInventoryTail(tail);
    return {
      sectionKey: "sheet.inventory",
      itemIndex: index,
      itemKind: draft?.kind,
      itemLabel: draft?.name.trim() || undefined,
      fieldKey,
      fieldFallback: fieldKey ? undefined : humanizeTail(tail),
    };
  }

  return { sectionKey: "sheet.basics", fieldFallback: path };
}

function fieldKeyForSkillTail(tail: string): string | undefined {
  if (tail === "name") return "characterSheets.skills.name";
  if (tail === "value") return "characterSheets.skills.value";
  if (tail.endsWith(".name")) return "characterSheets.skills.specialization";
  if (tail.endsWith(".value")) return "characterSheets.skills.value";
  return undefined;
}

function fieldKeyForInventoryTail(tail: string): string | undefined {
  if (!tail) return undefined;
  if (INVENTORY_SUFFIX_FIELDS[tail]) return INVENTORY_SUFFIX_FIELDS[tail];
  for (const [suffix, key] of Object.entries(INVENTORY_SUFFIX_FIELDS)) {
    if (tail.endsWith(suffix)) return key;
  }
  return undefined;
}

function humanizeTail(tail: string): string | undefined {
  if (!tail) return undefined;
  const last = tail.split(".").pop();
  return last?.replace(/_/g, " ");
}

export type ComplianceTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function formatComplianceErrorLine(line: ComplianceErrorLine, t: ComplianceTranslate): string {
  if (line.id === "skillPoints") return t(line.messageKey);

  const parts: string[] = [t(line.sectionKey)];

  if (line.itemIndex !== undefined) {
    const kindLabel = line.itemKind ? t(`characterSheets.inventory.kinds.${line.itemKind}`) : "";
    const name = line.itemLabel || t("characterSheets.inventory.unnamed");
    const kind = kindLabel ? ` (${kindLabel})` : "";
    parts.push(t("mode.complianceItem", { index: line.itemIndex + 1, name, kind }));
  } else if (line.skillLabel) {
    parts.push(line.skillLabel);
  }

  const fieldLabel = line.fieldKey ? t(line.fieldKey) : line.fieldFallback;
  if (fieldLabel) parts.push(fieldLabel);

  return t("mode.complianceLine", {
    place: parts.join(" · "),
    message: t(line.messageKey),
  });
}
