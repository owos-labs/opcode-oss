import { OPCODE_HEALTH_PARTS } from "./characterSheet.types";
import { resolveItemPresetDtoForLocale } from "./item-preset-dto";
import type { ItemPresetCategory, ItemPresetData } from "./item-presets.types";
import type { Locale } from "./i18n-messages";
import { resolveLocaleText } from "./locale-text";
import { readOpcodeWeaponFireModes } from "./opcodeInventory";

export type ItemPresetDetailRow = { labelKey: string; value: string };

export type ItemPresetModification = {
  id: string;
  slot: string;
  name: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function damageDice(damage: unknown): string {
  if (!isRecord(damage)) return "";
  return text(damage.dice);
}

function fireModeLabelKey(mode: "semi" | "auto" | "burst"): string {
  return `characterSheets.inventory.weapon.modes.${mode}`;
}

function levelLabelKey(prefix: string, value: unknown): string {
  const raw = text(value);
  if (/^\d+$/.test(raw)) return `${prefix}.${raw}`;
  const map: Record<string, string> = { E: "0", G: "1", C: "2", P: "3", N: "4", V: "0", U: "2" };
  const level = map[raw.slice(0, 1).toUpperCase()];
  return level ? `${prefix}.${level}` : "";
}

function pushRow(rows: ItemPresetDetailRow[], labelKey: string, value: string) {
  if (value) rows.push({ labelKey, value });
}

export function listItemPresetModifications(data: ItemPresetData, locale: Locale): ItemPresetModification[] {
  const weapon = isRecord(data.weapon) ? data.weapon : null;
  const mods = weapon && isRecord(weapon.modifications) ? weapon.modifications : null;
  if (!mods) return [];
  const out: ItemPresetModification[] = [];
  for (const [slot, instances] of Object.entries(mods)) {
    if (slot === "magazine" || !isRecord(instances)) continue;
    for (const [id, raw] of Object.entries(instances)) {
      if (!isRecord(raw)) continue;
      out.push({
        id,
        slot,
        name: text(raw.name) || id,
        description: resolveLocaleText(raw.description, locale),
      });
    }
  }
  return out;
}

export function listItemPresetDetailRows(
  category: ItemPresetCategory,
  data: ItemPresetData,
  locale: Locale,
): ItemPresetDetailRow[] {
  const resolved = resolveItemPresetDtoForLocale(data, locale) as ItemPresetData;
  const rows: ItemPresetDetailRow[] = [];
  const count = text(resolved.count);
  if (count && count !== "1") pushRow(rows, "characterSheets.inventory.fields.count", count);
  const weight = text(resolved.weight);
  if (weight && weight !== "0") pushRow(rows, "characterSheets.inventory.weapon.weight", `${weight} kg`);

  if (resolved.type === "weapon" || category === "melee" || category === "ranged") {
    const weapon = isRecord(resolved.weapon) ? resolved.weapon : null;
    if (!weapon) return rows;
    const weaponType = text(weapon.type);
    if (weaponType === "melee" || weaponType === "ranged") {
      pushRow(rows, "characterSheets.inventory.weapon.weaponType", `characterSheets.inventory.weapon.types.${weaponType}`);
    }
    pushRow(rows, "characterSheets.inventory.fields.caliber", text(weapon.caliber));
    pushRow(rows, "characterSheets.inventory.weapon.damage", damageDice(weapon.damage));
    const range = text(weapon.range);
    if (range) pushRow(rows, "characterSheets.inventory.weapon.range", `${range} m`);
    const rof = text(weapon.rof);
    if (rof) pushRow(rows, "characterSheets.inventory.weapon.rof", `${rof}/min`);
    pushRow(rows, "characterSheets.inventory.weapon.accuracy", text(weapon.accuracy));
    const concealKey = levelLabelKey("characterSheets.inventory.weapon.concealabilityLevels", weapon.concealability);
    if (concealKey) pushRow(rows, "characterSheets.inventory.weapon.concealability", concealKey);
    else pushRow(rows, "characterSheets.inventory.weapon.concealability", text(weapon.concealability));
    const reliabilityKey = levelLabelKey("characterSheets.inventory.weapon.reliabilityLevels", weapon.reliability);
    if (reliabilityKey) pushRow(rows, "characterSheets.inventory.weapon.reliability", reliabilityKey);
    else pushRow(rows, "characterSheets.inventory.weapon.reliability", text(weapon.reliability));
    const weaponWeight = text(weapon.weight);
    if (weaponWeight) pushRow(rows, "characterSheets.inventory.weapon.weight", `${weaponWeight} kg`);
    const modes = readOpcodeWeaponFireModes(text(weapon.mode));
    if (modes.length) {
      pushRow(rows, "characterSheets.inventory.weapon.mode", modes.map((mode) => fireModeLabelKey(mode)).join(", "));
    }
    return rows;
  }

  if (resolved.type === "ammo" || resolved.type === "throwable" || category === "ammo" || category === "throwable") {
    const ammo = isRecord(resolved.ammo) ? resolved.ammo : null;
    if (!ammo) return rows;
    pushRow(rows, "characterSheets.inventory.fields.caliber", text(ammo.caliber));
    const kind = text(ammo.damage);
    if (kind) pushRow(rows, "characterSheets.inventory.ammo.damageKind", `characterSheets.inventory.ammo.kinds.${kind}`);
    pushRow(rows, "characterSheets.inventory.ammo.penetration", text(ammo.penetration));
    pushRow(rows, "characterSheets.inventory.ammo.projectileCount", text(ammo.projectileCount));
    const dice = damageDice(ammo.damage) || damageDice(ammo.ballDamage) || damageDice(ammo.buckDamage);
    if (dice) pushRow(rows, "characterSheets.inventory.weapon.damage", dice);
    return rows;
  }

  if (resolved.type === "magazine" || category === "magazines") {
    const magazine = isRecord(resolved.magazine) ? resolved.magazine : null;
    if (!magazine) return rows;
    pushRow(rows, "characterSheets.inventory.fields.caliber", text(magazine.caliber));
    pushRow(rows, "characterSheets.inventory.magazine.capacity", text(magazine.containsMax));
    return rows;
  }

  if (resolved.type === "armor" || category === "armor") {
    const armor = isRecord(resolved.armor) ? resolved.armor : null;
    if (!armor) return rows;
    const material = text(armor.material);
    if (material) pushRow(rows, "characterSheets.inventory.armor.material", material);
    pushRow(rows, "characterSheets.inventory.armor.layer", text(armor.layer));
    const protection = isRecord(armor.protection) && isRecord(armor.protection.normal)
      ? armor.protection.normal
      : isRecord(armor.protection)
        ? armor.protection
        : null;
    if (protection) {
      for (const part of OPCODE_HEALTH_PARTS) {
        const value = text(protection[part]);
        if (value && value !== "0") {
          pushRow(rows, `characterSheets.health.${part}`, value);
        }
      }
    }
    return rows;
  }

  if (isRecord(resolved.attachment)) {
    const slot = text(resolved.attachment.slot);
    if (slot) {
      pushRow(
        rows,
        "characterSheets.inventory.modifications.slots.attachment",
        `characterSheets.inventory.modifications.slots.${slot}`,
      );
    }
    const effect = resolveLocaleText(resolved.attachment.effect, locale);
    if (effect) pushRow(rows, "characterSheets.inventory.fields.desc", effect);
    return rows;
  }

  return rows;
}
