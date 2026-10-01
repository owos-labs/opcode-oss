import {
  orderedBarrierHits,
  type BallisticBarrier,
  type OrderedBarrierHit,
} from "../combat-ai/geometry.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";

export type BallisticResolution = {
  reachesTarget: boolean;
  remainingPenetration: number;
  expectedDamageDice: number;
  sspDeductionByBarrierId: Readonly<Record<string, number>>;
};

function ballisticObjectId(barrierId: string): string {
  return barrierId.replace(/-e\d+$/, "");
}

/**
 * Vision-blocking walls only, one layer per object.
 * Concealment / cover edges are hit-difficulty, not extra dice sinks.
 */
export function combatBallisticHits(
  observer: Vec2,
  target: Vec2,
  barriers: readonly BallisticBarrier[],
): OrderedBarrierHit[] {
  const raw = orderedBarrierHits(
    observer,
    target,
    barriers.filter((b) => b.blocksVision),
  );
  const nearest = new Map<string, OrderedBarrierHit>();
  for (const hit of raw) {
    const id = ballisticObjectId(hit.barrierId);
    const prev = nearest.get(id);
    if (!prev || hit.t < prev.t) nearest.set(id, { ...hit, barrierId: id });
  }
  return [...nearest.values()].sort((a, b) => a.t - b.t);
}

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
