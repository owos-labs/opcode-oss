/** 1.5/1.6：欠穿 1/4 骰（至少 1 颗）；穿透后每 10 过穿减 1 骰，至少保留一半（向上取整）。 */
export function armorAdjustedDamageDice(input: {
  baseDice: number;
  /** ammo penetration minus armor rating at hit location */
  penetrationMargin: number;
}): { maxDice: number; kind: "under" | "normal" | "over" } {
  const base = Math.max(0, Math.floor(input.baseDice));
  if (base <= 0) return { maxDice: 0, kind: "normal" };

  if (input.penetrationMargin < 0) {
    return { maxDice: Math.max(1, Math.ceil(base / 4)), kind: "under" };
  }

  const lost = Math.floor(input.penetrationMargin / 10);
  const minHalf = Math.ceil(base / 2);
  const maxDice = Math.max(minHalf, base - lost);
  const kind = lost > 0 ? "over" : "normal";
  return { maxDice, kind };
}

export function applyUnderPenetrationDamageFloor(
  kind: "under" | "normal" | "over",
  total: number,
): number {
  if (kind === "under") return Math.max(1, total);
  return Math.max(0, total);
}
