/** Canonical SVG cover-height fractions (docs/map.impl.py + 1/3 band). */
export const COVER_HEIGHT_FRACTIONS = ["0.333", "0.5", "0.75", "1"] as const;

export type CoverHeightFraction = (typeof COVER_HEIGHT_FRACTIONS)[number];

const FRACTION_NUMBERS = COVER_HEIGHT_FRACTIONS.map(Number);

/** Map stored cover-height to the nearest editor option. */
export function normalizeCoverHeightFraction(raw: string | undefined): CoverHeightFraction {
  const f = Number(raw);
  if (!Number.isFinite(f)) return "0.75";
  let best: CoverHeightFraction = "0.75";
  let bestDist = Infinity;
  for (let i = 0; i < FRACTION_NUMBERS.length; i++) {
    const dist = Math.abs(f - FRACTION_NUMBERS[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = COVER_HEIGHT_FRACTIONS[i]!;
    }
  }
  return best;
}

export function coverHeightSelectOptions(t: (key: string) => string) {
  return [
    { value: "0.333", label: t("combat.editor.coverHeight.third") },
    { value: "0.5", label: t("combat.editor.coverHeight.half") },
    { value: "0.75", label: t("combat.editor.coverHeight.twoThirds") },
    { value: "1", label: t("combat.editor.coverHeight.full") },
  ];
}
