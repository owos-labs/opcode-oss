/** Parse `3d6+1`, `2d4-1`, `4d6+2-1` into dice groups and flat modifier. */
export function parseOpcodeDamageExpr(expr: string): {
  groups: { count: number; sides: number }[];
  flatModifier: number;
} {
  const groups: { count: number; sides: number }[] = [];
  const diceRegex = /(\d+)\s*d(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = diceRegex.exec(expr)) !== null) {
    groups.push({ count: Number(match[1]), sides: Number(match[2]) });
  }
  const withoutDice = expr.replace(/\d+\s*d\d+/gi, "");
  let flatModifier = 0;
  for (const token of withoutDice.match(/[+-]?\d+/g) ?? []) {
    flatModifier += Number(token);
  }
  return { groups, flatModifier };
}

export function rollOpcodeDamageExpr(
  expr: string,
  rng: () => number,
  maxDice?: number,
): { dieFaces: readonly number[]; flatModifier: number; total: number } {
  const { groups, flatModifier } = parseOpcodeDamageExpr(expr);
  if (!groups.length) {
    return { dieFaces: [], flatModifier, total: flatModifier };
  }
  let budget = maxDice ?? groups.reduce((sum, g) => sum + g.count, 0);
  const dieFaces: number[] = [];
  for (const group of groups) {
    const n = Math.min(group.count, Math.max(0, budget));
    budget -= n;
    for (let i = 0; i < n; i++) {
      dieFaces.push(1 + Math.floor(rng() * group.sides));
    }
  }
  const total = dieFaces.reduce((sum, face) => sum + face, 0) + flatModifier;
  return { dieFaces, flatModifier, total: Math.max(0, total) };
}
