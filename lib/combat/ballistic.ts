import type { OrderedBarrierHit } from "../combat-ai/geometry.ts";

export type BallisticResolution = {
  reachesTarget: boolean;
  remainingPenetration: number;
  expectedDamageDice: number;
  sspDeductionByBarrierId: Readonly<Record<string, number>>;
};

/**
 * Ordered AR resolution (MVP): pen vs AR per hit, -1 expected damage die per penetrated layer.
 * Full 1.5 thickness / over-pen rules can extend here; FSM applies SSP from sspDeduction map.
 */
export function resolveBallisticToTarget(
  ammoPenetration: number,
  expectedDamageDice: number,
  hits: readonly OrderedBarrierHit[],
): BallisticResolution {
  let pen = ammoPenetration;
  let dice = Math.max(0, expectedDamageDice);
  const sspDeductionByBarrierId: Record<string, number> = {};

  for (const hit of hits) {
    if (pen < hit.armorRating) {
      return {
        reachesTarget: false,
        remainingPenetration: pen,
        expectedDamageDice: 0,
        sspDeductionByBarrierId,
      };
    }
    pen -= hit.armorRating;
    dice = Math.max(0, dice - 1);
    const expectedChip = Math.max(1, Math.floor(dice));
    sspDeductionByBarrierId[hit.barrierId] =
      (sspDeductionByBarrierId[hit.barrierId] ?? 0) + expectedChip;
  }

  return {
    reachesTarget: true,
    remainingPenetration: pen,
    expectedDamageDice: dice,
    sspDeductionByBarrierId,
  };
}
