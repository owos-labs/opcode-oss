import { OPCODE_HEALTH_PARTS } from "./characterSheet.types";
import {
  groupInventoryByKind,
  inventoryListFacts,
  summarizeOpcodeWeaponList,
} from "./opcodeInventory";
import type { OpcodeInventoryDraft } from "./opcodeInventory.types";

const KIND_HEADING: Record<OpcodeInventoryDraft["kind"], string> = {
  weapon: "Weapons",
  ammo: "Ammunition",
  magazine: "Magazines",
  throwable: "Throwables",
  armor: "Armor",
  generic: "Other gear",
};

type ExportContainer = { name: string; items: string[] };

function itemLocation(itemId: string, containers: Record<string, ExportContainer>): string {
  for (const container of Object.values(containers)) {
    if (container.items.includes(itemId)) {
      return container.name.trim() || "container";
    }
  }
  return "loose";
}

function pushLine(lines: string[], label: string, value: string | undefined) {
  const text = value?.trim();
  if (text) lines.push(`  - ${label}: ${text}`);
}

function damageDice(damage: Record<string, unknown> | undefined): string {
  const dice = damage?.dice;
  return typeof dice === "string" && dice.trim() ? dice.trim() : "";
}

function formatWeapon(
  draft: OpcodeInventoryDraft,
  drafts: OpcodeInventoryDraft[],
  byId: Map<string, OpcodeInventoryDraft>,
): string[] {
  const weapon = draft.weapon;
  if (!weapon) return [];
  const lines: string[] = [];
  const summary = summarizeOpcodeWeaponList(draft, drafts);
  pushLine(lines, "type", weapon.type);
  pushLine(lines, "caliber", weapon.caliber);
  pushLine(lines, "damage", damageDice(weapon.damage));
  pushLine(lines, "range", weapon.range ? `${weapon.range} m` : "");
  pushLine(lines, "rof", weapon.rof ? `${weapon.rof}/min` : "");
  pushLine(lines, "accuracy", weapon.accuracy);
  pushLine(lines, "weight", weapon.weight ? `${weapon.weight} kg` : draft.weight ? `${draft.weight} kg` : "");
  if (summary?.modes.length) pushLine(lines, "fire modes", summary.modes.join(", "));
  if (summary?.magazineName) {
    const load =
      summary.capacity == null
        ? `${summary.loadedCount} loaded`
        : `${summary.loadedCount}/${summary.capacity}`;
    pushLine(lines, "magazine", `${summary.magazineName} (${load})`);
  }
  if (summary?.attachments.length) pushLine(lines, "attachments", summary.attachments.join(", "));
  for (const mod of weapon.modifications) {
    const label = mod.name.trim() || mod.slot.trim() || mod.id;
    if (!label) continue;
    const note = mod.description.trim();
    lines.push(`  - mod · ${label}${note ? `: ${note}` : ""}`);
  }
  for (const skill of weapon.skills) {
    if (!skill.name.trim()) continue;
    const specs = (skill.specializations || [])
      .filter((spec) => spec.name.trim())
      .map((spec) => `${spec.name}×${spec.mul}`)
      .join(", ");
    lines.push(`  - skill · ${skill.name}×${skill.mul}${specs ? ` (${specs})` : ""}`);
  }
  if (weapon.magazineId && !summary?.magazineName) {
    const mag = byId.get(weapon.magazineId);
    pushLine(lines, "magazine id", mag?.name.trim() || weapon.magazineId);
  }
  return lines;
}

function formatAmmo(draft: OpcodeInventoryDraft): string[] {
  const ammo = draft.ammo;
  if (!ammo) return [];
  const lines: string[] = [];
  pushLine(lines, "caliber", ammo.caliber);
  pushLine(lines, "damage kind", ammo.damage);
  pushLine(lines, "penetration", ammo.penetration);
  if (ammo.damage === "ball") pushLine(lines, "damage", damageDice(ammo.ballDamage));
  if (ammo.damage === "buck") {
    pushLine(lines, "projectiles", ammo.projectileCount);
    pushLine(lines, "damage", damageDice(ammo.buckDamage));
  }
  for (const explosive of ammo.explosives || []) {
    const type = explosive.type.trim();
    if (!type) continue;
    lines.push(
      `  - explosive · ${type}: lethal ${explosive.lethal || "—"}, wound ${explosive.wound || "—"} m, fuse ${explosive.fuse || "—"} m`,
    );
  }
  return lines;
}

function formatMagazine(draft: OpcodeInventoryDraft, byId: Map<string, OpcodeInventoryDraft>): string[] {
  const magazine = draft.magazine;
  if (!magazine) return [];
  const lines: string[] = [];
  pushLine(lines, "caliber", magazine.caliber);
  pushLine(lines, "capacity", magazine.containsMax);
  pushLine(lines, "loaded", `${magazine.loaded.length}/${magazine.containsMax || "?"}`);
  const tokenKinds = Object.entries(magazine.kinds)
    .map(([token, ammoId]) => {
      const ammo = byId.get(ammoId);
      return `${token}→${ammo?.name.trim() || ammoId}`;
    })
    .join(", ");
  pushLine(lines, "round map", tokenKinds);
  return lines;
}

function formatArmor(draft: OpcodeInventoryDraft): string[] {
  const armor = draft.armor;
  if (!armor) return [];
  const lines: string[] = [];
  pushLine(lines, "material", armor.material);
  pushLine(lines, "layer", armor.layer);
  const parts = OPCODE_HEALTH_PARTS.map((part) => {
    const value = armor.protection[part]?.trim();
    if (!value || value === "0") return null;
    return `${part} ${value}`;
  }).filter(Boolean);
  if (parts.length) pushLine(lines, "protection", parts.join(", "));
  return lines;
}

function formatInventoryItem(
  draft: OpcodeInventoryDraft,
  drafts: OpcodeInventoryDraft[],
  byId: Map<string, OpcodeInventoryDraft>,
  containers: Record<string, ExportContainer>,
): string {
  const title = draft.name.trim() || draft.id;
  const facts = inventoryListFacts(draft, drafts);
  const headline = [`### ${title}`, `  - id: ${draft.id}`, `  - location: ${itemLocation(draft.id, containers)}`];
  if (draft.count.trim() && draft.count !== "1") headline.push(`  - count: ${draft.count}`);
  if (draft.weight.trim() && draft.kind !== "weapon") headline.push(`  - weight: ${draft.weight} kg`);
  if (draft.desc.trim()) headline.push(`  - desc: ${draft.desc.trim()}`);
  if (facts.length) headline.push(`  - summary: ${facts.join(" · ")}`);

  let detail: string[] = [];
  if (draft.kind === "weapon") detail = formatWeapon(draft, drafts, byId);
  else if (draft.kind === "ammo" || draft.kind === "throwable") detail = formatAmmo(draft);
  else if (draft.kind === "magazine") detail = formatMagazine(draft, byId);
  else if (draft.kind === "armor") detail = formatArmor(draft);

  return [...headline, ...detail].join("\n");
}

export function inventoryExportMarkdown(
  drafts: OpcodeInventoryDraft[],
  containers: Record<string, ExportContainer>,
): string {
  const groups = groupInventoryByKind(drafts);
  if (!groups.length) return "_empty_";
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  return groups
    .map(({ kind, items }) => {
      const body = items
        .map((draft) => formatInventoryItem(draft, drafts, byId, containers))
        .join("\n\n");
      return `## ${KIND_HEADING[kind]}\n\n${body}`;
    })
    .join("\n\n");
}
