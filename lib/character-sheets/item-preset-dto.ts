import type { Locale } from "./i18n-messages";
import {
  localizePresetUserFacingFields,
  normalizeLocaleText,
  resolvePresetUserFacingFields,
} from "./locale-text.ts";
import type { OpcodeAmmoDamageKind, OpcodeInventoryItemWire } from "./opcodeInventory.types";

const CONCEALABILITY: Record<string, number> = { E: 0, G: 1, C: 2, P: 3, N: 4 };
const RELIABILITY: Record<string, number> = { V: 0, N: 1, U: 2 };
const AMMO_KINDS = new Set<string>(["ball", "buck", "explosive"]);

function resolveDescSource(raw: Record<string, unknown>): string {
  const chunks: string[] = [];
  if (typeof raw.desc === "string") chunks.push(raw.desc);
  else {
    const localized = normalizeLocaleText(raw.desc);
    if (localized?.zh) chunks.push(localized.zh);
    else if (localized?.en) chunks.push(localized.en);
    else if (localized?.ja) chunks.push(localized.ja);
  }
  if (typeof raw.notes === "string" && raw.notes.trim()) chunks.push(raw.notes.trim());
  return chunks.join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^[+-]?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const next = Number(match[0]);
  return Number.isFinite(next) ? next : undefined;
}

function parseInteger(value: unknown): number | undefined {
  const next = parseFiniteNumber(value);
  if (next === undefined) return undefined;
  return Number.isInteger(next) ? next : Math.trunc(next);
}

/** Remove parenthetical base-model references from preset descriptions (legal). */
export function stripBaseModelFromDesc(desc: string): string {
  return desc
    .replace(/\s*[（(]\s*基础型号\s*[：:][^）)]*[）)]/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapLevel(value: unknown, table: Record<string, number>): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return undefined;
  const key = value.trim().toUpperCase();
  if (key in table) return table[key];
  return parseInteger(value);
}

function normalizeWeaponDamage(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return structuredClone(value);
  if (typeof value === "string" && value.trim()) return { dice: value.trim() };
  return {};
}

function normalizeWeaponBlock(weapon: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(weapon);
  next.damage = normalizeWeaponDamage(next.damage);

  const conceal = mapLevel(next.concealability, CONCEALABILITY);
  if (conceal !== undefined) next.concealability = conceal;

  const reliability = mapLevel(next.reliability, RELIABILITY);
  if (reliability !== undefined) next.reliability = reliability;

  for (const key of ["range", "accuracy", "rof", "weight"] as const) {
    const num = parseFiniteNumber(next[key]);
    if (num !== undefined) next[key] = num;
  }

  const mode = parseInteger(next.mode);
  if (mode !== undefined) next.mode = mode;
  else if (next.type === "melee" && next.mode === undefined) next.mode = 0;

  if (next.type === "melee") {
    if (next.range === undefined) next.range = 1;
    if (next.rof === undefined) next.rof = 20;
  }

  delete next.skills;
  delete next.attributes;
  delete next.penetration;
  delete next.minimumBod;
  delete next.additionalActions;

  return next;
}

function normalizeAmmoBlock(ammo: Record<string, unknown>, throwable: boolean): Record<string, unknown> {
  const next = structuredClone(ammo);
  delete next.type;

  const penetration = parseInteger(next.penetration);
  if (penetration !== undefined) next.penetration = penetration;

  let kind = typeof next.damage === "string" ? next.damage.trim() : "";
  const legacyDice = kind && !AMMO_KINDS.has(kind) ? kind : "";

  if (AMMO_KINDS.has(kind)) {
    // already canonical
  } else if (throwable || Array.isArray(next.explosives)) {
    kind = "explosive";
    next.damage = kind;
  } else if (kind.toLowerCase() === "buck" || next.projectileCount !== undefined) {
    kind = "buck";
    next.damage = kind;
  } else {
    kind = "ball";
    next.damage = kind;
  }

  if (legacyDice) {
    if (kind === "ball") {
      const ball = isRecord(next.ball) ? structuredClone(next.ball) : {};
      if (!isRecord(ball.damage)) ball.damage = { dice: legacyDice };
      else if (!Object.keys(ball.damage).length) ball.damage = { dice: legacyDice };
      next.ball = ball;
    } else if (kind === "buck") {
      const buck = isRecord(next.buck) ? structuredClone(next.buck) : {};
      if (!isRecord(buck.damage)) buck.damage = { dice: legacyDice };
      next.buck = buck;
    }
  }

  const projectileCount = parseInteger(next.projectileCount);
  if (projectileCount !== undefined) {
    const buck = isRecord(next.buck) ? structuredClone(next.buck) : {};
    buck.projectile_count = projectileCount;
    next.buck = buck;
    delete next.projectileCount;
  }

  if (Array.isArray(next.explosives)) {
    const explosive: Record<string, unknown> = isRecord(next.explosive) ? structuredClone(next.explosive) : {};
    next.explosives.filter(isRecord).forEach((entry, index) => {
      explosive[String(index)] = {
        type: typeof entry.type === "string" ? entry.type : "frag",
        damage: normalizeWeaponDamage(entry.damage),
        lethal: parseInteger(entry.lethal) ?? 0,
        wound: parseInteger(entry.wound) ?? 0,
        persistance: parseInteger(entry.persistance) ?? 0,
        fuse: parseInteger(entry.fuse) ?? 0,
      };
    });
    next.explosive = explosive;
    delete next.explosives;
  }

  if (kind === "ball" && !isRecord(next.ball)) next.ball = { damage: {} };
  if (kind === "buck" && !isRecord(next.buck)) next.buck = { damage: {} };

  return next;
}

function normalizeMagazineBlock(magazine: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(magazine);
  const legacyMax = next.containsMax;
  delete next.containsMax;

  const ammo = isRecord(next.ammo) ? structuredClone(next.ammo) : {};
  const containsMax = parseInteger(ammo.contains_max ?? legacyMax);
  if (containsMax !== undefined) ammo.contains_max = containsMax;
  if (Object.keys(ammo).length) next.ammo = ammo;

  return next;
}

function normalizeArmorBlock(armor: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(armor);
  const layer = parseInteger(next.layer);
  if (layer !== undefined) next.layer = layer;

  const protection = isRecord(next.protection) ? structuredClone(next.protection) : {};
  if (isRecord(protection.normal)) {
    next.protection = protection;
    return next;
  }

  const normal: Record<string, number> = {};
  for (const [part, value] of Object.entries(protection)) {
    const num = parseFiniteNumber(value);
    if (num !== undefined) normal[part] = num;
  }
  next.protection = { normal };
  delete next.primaryAr;
  delete next.ar;
  return next;
}

/** Map legacy preset `data` to inventory item wire shape from character_sheet_dto. */
export function normalizeItemPresetDto(raw: Record<string, unknown>): OpcodeInventoryItemWire {
  const next = structuredClone(raw) as Record<string, unknown>;

  if (typeof next.kind === "string") {
    if (next.kind !== "generic" && next.type === undefined) next.type = next.kind;
    delete next.kind;
  }
  delete next.source;

  delete next.base_model;
  let descSource = resolveDescSource(next);
  descSource = stripBaseModelFromDesc(descSource);
  const desc = normalizeLocaleText(descSource);
  if (desc) next.desc = desc;
  else delete next.desc;
  delete next.notes;

  const count = parseInteger(next.count);
  next.count = count ?? 1;

  const weight = parseFiniteNumber(next.weight);
  if (weight !== undefined) next.weight = weight;

  if (isRecord(next.weapon)) next.weapon = normalizeWeaponBlock(next.weapon);
  if (isRecord(next.ammo)) {
    next.ammo = normalizeAmmoBlock(next.ammo, next.type === "throwable");
  }
  if (isRecord(next.magazine)) next.magazine = normalizeMagazineBlock(next.magazine);
  if (isRecord(next.armor)) next.armor = normalizeArmorBlock(next.armor);

  localizePresetUserFacingFields(next);

  return next as OpcodeInventoryItemWire;
}

export function resolveItemPresetDtoForLocale(
  data: OpcodeInventoryItemWire,
  locale: Locale,
): OpcodeInventoryItemWire {
  const next = structuredClone(data) as Record<string, unknown>;
  resolvePresetUserFacingFields(next, locale);
  return next as OpcodeInventoryItemWire;
}

export function ammoBallDice(ammo: unknown): string {
  if (!isRecord(ammo)) return "";
  const ball = isRecord(ammo.ball) ? ammo.ball : null;
  const damage = ball && isRecord(ball.damage) ? ball.damage : null;
  return damage && typeof damage.dice === "string" ? damage.dice : "";
}

export function isCanonicalAmmoDamageKind(value: unknown): value is OpcodeAmmoDamageKind {
  return typeof value === "string" && AMMO_KINDS.has(value);
}
