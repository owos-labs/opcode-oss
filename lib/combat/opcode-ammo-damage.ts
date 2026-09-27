import type {
  OpcodeAmmoDamageKind,
  OpcodeAmmoDraft,
  OpcodeExplosiveDraft,
} from "../character-sheets/opcodeInventory.types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads `dice`, `expression`, or nested `damage.dice` from inventory damage records. */
export function damageDiceExprFromDamageRecord(
  record: Record<string, unknown> | undefined,
): string {
  if (!record) return "";
  if (typeof record.dice === "string" && record.dice.trim()) return record.dice.trim();
  if (typeof record.expression === "string" && record.expression.trim()) {
    return record.expression.trim();
  }
  const nested = record.damage;
  if (isRecord(nested)) return damageDiceExprFromDamageRecord(nested);
  return "";
}

export function damageDiceExprFromAmmoDraft(ammo: OpcodeAmmoDraft | undefined): string {
  if (!ammo) return "";
  const fromBall = damageDiceExprFromDamageRecord(ammo.ballDamage);
  const fromBuck = damageDiceExprFromDamageRecord(ammo.buckDamage);
  if (ammo.damage === "ball") return fromBall;
  if (ammo.damage === "buck") return fromBuck;
  if (ammo.damage === "explosive" && ammo.explosives?.[0]) {
    return damageDiceExprFromDamageRecord(ammo.explosives[0]!.damage);
  }
  // Sheets may omit damage kind while still carrying ball/buck records.
  return fromBall || fromBuck || "";
}

export function setDamageDiceOnRecord(
  record: Record<string, unknown>,
  dice: string,
): Record<string, unknown> {
  const next = { ...record };
  const trimmed = dice.trim();
  if (trimmed) next.dice = trimmed;
  else delete next.dice;
  delete next.expression;
  return next;
}

function emptyExplosive(): OpcodeExplosiveDraft {
  return {
    id: "0",
    type: "frag",
    damage: {},
    lethal: "0",
    wound: "0",
    persistance: "0",
    fuse: "0",
    source: {},
  };
}

/** Seeds the branch record the current damage kind needs. */
export function setAmmoDamageKind(ammo: OpcodeAmmoDraft, kind: OpcodeAmmoDamageKind): void {
  ammo.damage = kind;
  if (kind === "explosive" && !ammo.explosives.length) ammo.explosives.push(emptyExplosive());
  if (kind === "buck" && !String(ammo.projectileCount).trim()) ammo.projectileCount = "1";
}

/** Writes dice onto the record for the ammo's current damage kind. */
export function setAmmoDamageDice(ammo: OpcodeAmmoDraft, dice: string): void {
  if (ammo.damage === "explosive" && !ammo.explosives[0]) ammo.explosives.push(emptyExplosive());
  if (ammo.damage === "ball") ammo.ballDamage = setDamageDiceOnRecord(ammo.ballDamage, dice);
  else if (ammo.damage === "buck") ammo.buckDamage = setDamageDiceOnRecord(ammo.buckDamage, dice);
  else if (ammo.damage === "explosive" && ammo.explosives[0]) {
    ammo.explosives[0].damage = setDamageDiceOnRecord(ammo.explosives[0].damage, dice);
  }
}
