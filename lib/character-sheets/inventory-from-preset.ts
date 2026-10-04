import { OPCODE_HEALTH_PARTS as HEALTH_PARTS } from "./characterSheet.types";
import { resolveItemPresetDtoForLocale } from "./item-preset-dto";
import type { ItemPreset } from "./item-presets.types";
import type { Locale } from "./i18n-messages";
import { resolveLocaleText } from "./locale-text";
import { createOpcodeInventoryDraft } from "./opcodeInventory";
import type {
  OpcodeInventoryDraft,
  OpcodeInventoryItemKind,
  OpcodeModEffectDraft,
  OpcodeWeaponModificationDraft,
} from "./opcodeInventory.types";
import {
  OPCODE_AMMO_DAMAGE_KINDS,
  OPCODE_INVENTORY_TYPED_KINDS,
  OPCODE_WEAPON_FIRE_MODE_BITS,
} from "./opcodeInventory.types";

export function inventoryDraftFromPreset(preset: ItemPreset, locale: Locale): OpcodeInventoryDraft {
  const data = resolveItemPresetDtoForLocale(preset.data, locale);
  const draft = createOpcodeInventoryDraft(readItemPresetKind(data));
  draft.source = {
    presetId: preset.id,
    presetCategory: preset.category,
    presetData: structuredClone(data),
  };
  draft.name = typeof data.name === "string" ? data.name : String(data.name ?? "");
  draft.count = String(typeof data.count === "number" ? data.count : data.count ?? 1);
  const nestedWeight = isRecord(data.weapon) ? data.weapon.weight : isRecord(data.armor) ? data.armor.weight : undefined;
  draft.weight = presetLastNumber(data.weight ?? nestedWeight, "0");
  draft.desc = resolveLocaleText(data.desc, locale);
  if (draft.weapon && isRecord(data.weapon)) {
    const weapon = data.weapon;
    draft.weapon.type = weapon.type === "melee" ? "melee" : "ranged";
    draft.weapon.caliber = presetString(weapon.caliber, draft.weapon.caliber);
    draft.weapon.range = presetNumber(weapon.range, draft.weapon.range);
    draft.weapon.accuracy = presetNumber(weapon.accuracy, draft.weapon.accuracy);
    draft.weapon.concealability = presetLevel(weapon.concealability, { E: "0", G: "1", C: "2", P: "3", N: "4" }, draft.weapon.concealability);
    draft.weapon.rof = presetNumber(weapon.rof, draft.weapon.rof);
    draft.weapon.mode = presetFireMode(weapon.mode, draft.weapon.mode);
    draft.weapon.reliability = presetLevel(weapon.reliability, { V: "0", N: "1", U: "2" }, draft.weapon.reliability);
    draft.weapon.weight = presetNumber(weapon.weight, draft.weapon.weight);
    draft.weapon.damage = isRecord(weapon.damage)
      ? structuredClone(weapon.damage)
      : typeof weapon.damage === "string" ? { dice: weapon.damage } : {};
    draft.weapon.modifications = presetWeaponModifications(weapon.modifications);
  }
  if (draft.ammo && isRecord(data.ammo)) {
    const ammo = data.ammo;
    draft.ammo.caliber = presetString(ammo.caliber, draft.ammo.caliber);
    draft.ammo.damage = presetAmmoKind(ammo, data.type === "throwable");
    draft.ammo.penetration = presetNumber(ammo.penetration, draft.ammo.penetration);
    draft.ammo.projectileCount = presetNumber(ammo.projectileCount, draft.ammo.projectileCount);
    const damageDice = typeof ammo.damage === "string" && !OPCODE_AMMO_DAMAGE_KINDS.includes(ammo.damage as typeof OPCODE_AMMO_DAMAGE_KINDS[number])
      ? ammo.damage
      : "";
    if (damageDice && draft.ammo.damage === "buck") draft.ammo.buckDamage = { dice: damageDice };
    if (damageDice && draft.ammo.damage === "ball") draft.ammo.ballDamage = { dice: damageDice };
    if (Array.isArray(ammo.explosives)) {
      draft.ammo.explosives = ammo.explosives.filter(isRecord).map((entry) => ({
        id: crypto.randomUUID(),
        type: presetExplosiveType(entry.type),
        damage: isRecord(entry.damage) ? structuredClone(entry.damage) : damageDice ? { dice: damageDice } : {},
        lethal: presetNumber(entry.lethal, "0"),
        wound: presetNumber(entry.wound, "0"),
        persistance: presetNumber(entry.persistance, "0"),
        fuse: presetNumber(entry.fuse, "0"),
        source: { presetData: structuredClone(entry) },
      }));
    }
    if (draft.ammo.damage === "explosive" && !draft.ammo.explosives.length) {
      draft.ammo.explosives = [{
        id: crypto.randomUUID(),
        type: presetExplosiveType(ammo.damageType),
        damage: damageDice ? { dice: damageDice } : {},
        lethal: "0",
        wound: "0",
        persistance: "0",
        fuse: "0",
        source: { presetData: structuredClone(ammo) },
      }];
    }
  }
  if (draft.magazine && isRecord(data.magazine)) {
    draft.magazine.caliber = presetString(data.magazine.caliber, draft.magazine.caliber);
    draft.magazine.containsMax = presetNumber(data.magazine.containsMax, draft.magazine.containsMax);
  }
  if (draft.armor && isRecord(data.armor)) {
    draft.armor.material = presetArmorMaterial(data.armor.material);
    draft.armor.layer = presetNumber(data.armor.layer, draft.armor.layer);
    if (isRecord(data.armor.protection)) {
      for (const part of HEALTH_PARTS) {
        if (data.armor.protection[part] !== undefined) draft.armor.protection[part] = presetNumber(data.armor.protection[part], draft.armor.protection[part]);
      }
    }
    const representativeAr = data.armor.primaryAr ?? data.armor.ar;
    if (representativeAr !== undefined) draft.armor.protection.torso = presetLastNumber(representativeAr, draft.armor.protection.torso);
  }
  return draft;
}

function readItemPresetKind(data: Record<string, unknown>): OpcodeInventoryItemKind {
  const type = data.type;
  if (typeof type === "string" && (OPCODE_INVENTORY_TYPED_KINDS as readonly string[]).includes(type))
    return type as OpcodeInventoryItemKind;
  return "generic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function presetString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function presetNumber(value: unknown, fallback = "") {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const match = presetString(value).match(/[+-]?\d+(?:\.\d+)?/);
  return match ? String(Number(match[0])) : fallback;
}

function presetLastNumber(value: unknown, fallback = "") {
  const matches = presetString(value).match(/[+-]?\d+(?:\.\d+)?/g);
  if (!matches?.length) return fallback;
  return String(Number(matches[matches.length - 1]));
}

function presetLevel(value: unknown, levels: Record<string, string>, fallback: string) {
  const raw = presetString(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return raw;
  return levels[raw.slice(0, 1).toUpperCase()] || fallback;
}

function presetFireMode(value: unknown, fallback: string) {
  const raw = presetString(value).trim();
  if (/^\d+$/.test(raw)) return raw;
  let mode = 0;
  if (/\bSA\b|SEMI/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.semi;
  if (/\bFA\b|AUTO/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.auto;
  if (/\bB\b|BURST/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.burst;
  return mode ? String(mode) : fallback;
}

function presetAmmoKind(ammo: Record<string, unknown>, throwable: boolean) {
  if (throwable) return "explosive" as const;
  const type = presetString(ammo.type).toLowerCase();
  const damageType = presetString(ammo.damageType).toLowerCase();
  if (type.includes("buck") || type.includes("shotgun")) return "buck" as const;
  if (type.includes("explosive") || /he|frag|thermal/.test(damageType)) return "explosive" as const;
  return "ball" as const;
}

function presetExplosiveType(value: unknown) {
  const raw = presetString(value).trim().toLowerCase();
  if (raw === "f" || raw.includes("frag")) return "frag";
  if (raw === "t" || raw.includes("thermal") || raw.includes("incendiary")) return "thermal";
  return "he";
}

function presetArmorMaterial(value: unknown) {
  const raw = presetString(value, "ceramic").toLowerCase();
  if (raw.includes("ceramic")) return "ceramic";
  if (raw.includes("steel") || raw.includes("metal")) return "metal";
  if (raw.includes("soft") || raw.includes("composite") || raw.includes("pe")) return "uhmpe";
  return raw;
}

function presetWeaponModifications(value: unknown): OpcodeWeaponModificationDraft[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([slot, instances]) => {
    if (slot === "magazine" || !isRecord(instances)) return [];
    return Object.entries(instances).flatMap(([id, raw]) => {
      if (!isRecord(raw)) return [];
      return [{
        id,
        slot,
        name: presetString(raw.name),
        description: presetString(raw.description),
        effects: presetModificationEffects(raw.effects),
        source: structuredClone(raw),
      }];
    });
  });
}

function presetModificationEffects(value: unknown): OpcodeModEffectDraft[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, raw]) => {
    const record = isRecord(raw) ? raw : {};
    if (typeof record.enable_slot === "string") {
      return {
        key,
        kind: "enable_slot",
        slot: record.enable_slot,
        count: presetNumber(record.count, "1"),
        max: presetNumber(record.max, ""),
        target: "",
        flat: "",
        level: "",
        rangeMin: "",
        rangeMax: "",
        concealMax: "",
        note: "",
        source: structuredClone(record),
      };
    }
    const mod = isRecord(record.mod) ? record.mod : {};
    const valueRecord = isRecord(mod.value) ? mod.value : {};
    const applied = isRecord(valueRecord.applied_on) ? valueRecord.applied_on : {};
    const range = isRecord(applied.range_target) ? applied.range_target : {};
    const conceal = isRecord(applied.concealability) ? applied.concealability : {};
    const target = typeof mod.target === "string" && ["diff", "range", "caliber", "accuracy", "concealability", "weight"].includes(mod.target)
      ? mod.target as OpcodeModEffectDraft["target"]
      : "";
    return {
      key,
      kind: Object.keys(mod).length ? "mod" : "unknown",
      slot: "",
      count: "1",
      max: "",
      target,
      flat: presetNumber(valueRecord.flat, ""),
      level: presetNumber(valueRecord.level, ""),
      rangeMin: presetNumber(range.min, ""),
      rangeMax: presetNumber(range.max, ""),
      concealMax: presetNumber(conceal.max, ""),
      note: typeof applied.text === "string" ? applied.text : "",
      source: structuredClone(record),
    };
  });
}
