import type { CharacterActor } from "./actor.ts";
import { hasLineOfSight, type InformationBoundary, type WallSegment } from "./visibility.ts";
import type { Vec2 } from "./visibility.ts";

/** D10 combat information: Approximate → Exact → Full (Precise). */
export type CombatLocalizationLevel = "approximate" | "exact" | "full";

/** Combat difficulty band (height); pick one vs target-size mod. */
export type CoverHeightBand =
  | "none"
  | "leg"
  | "third"
  | "two_thirds"
  | "half"
  | "full";

/**
 * Emplacement class — must be decided before target visibility.
 * - half_body: enter/leave with **free action + movement action**.
 * - full_body: enter/leave with **movement action** only (whole move to toggle).
 */
export type CoverEmplacementKind = "half_body" | "full_body";

export type CoverToggleCost = {
  freeAction: boolean;
  movementAction: boolean;
};

export function coverToggleCost(emplacement: CoverEmplacementKind): CoverToggleCost {
  if (emplacement === "half_body") return { freeAction: true, movementAction: true };
  return { freeAction: false, movementAction: true };
}

export function coverHeightBandForEmplacement(emplacement: CoverEmplacementKind): CoverHeightBand {
  return emplacement === "half_body" ? "half" : "full";
}

/** One physical emplacement on the map (sandbags vs fighting hole). */
export type CoverEmplacement = {
  id: string;
  emplacement: CoverEmplacementKind;
  /** Distance from a point to enter this emplacement (rules layer sets geometry). */
  distanceToEnter: number;
};

/**
 * Per-emplacement slice: [is_enable, distance, target_vis[]].
 * Visibility is evaluated **from behind this emplacement**, not open ground.
 */
export type CoverEmplacementSlice = {
  coverId: string;
  emplacement: CoverEmplacementKind;
  enabled: boolean;
  distance: number;
  targetVis: readonly CombatLocalizationLevel[];
};

export type CoverEmplacementTargetRow = {
  targetId: string;
  localization: CombatLocalizationLevel;
  /** Target occupies the same emplacement (behind the same cover piece). */
  sharesEmplacement: boolean;
};

export function distanceBetween(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function localizationFromSight(
  hasLos: boolean,
  inBoundary: boolean,
): CombatLocalizationLevel {
  if (hasLos && inBoundary) return "full";
  if (inBoundary) return "exact";
  return "approximate";
}

/**
 * After emplacement kind is known, compute who the occupant can localize behind it.
 * Observer must already be committed to `coverId` (in or acting from that emplacement).
 */
export function buildEmplacementTargetVis(input: {
  emplacement: CoverEmplacement;
  observer: Vec2;
  observerUsesCover: boolean;
  targets: readonly CharacterActor[];
  /** Target id → emplacement id if they are behind cover, else null. */
  targetCoverId: Readonly<Record<string, string | null>>;
  boundary: InformationBoundary;
  walls?: readonly WallSegment[];
}): CoverEmplacementSlice {
  if (!input.observerUsesCover) {
    return {
      coverId: input.emplacement.id,
      emplacement: input.emplacement.emplacement,
      enabled: false,
      distance: input.emplacement.distanceToEnter,
      targetVis: input.targets.map(() => "approximate" as const),
    };
  }

  const walls = input.walls ?? [];
  const allowed = new Set(input.boundary.visibleIds);
  const targetVis: CombatLocalizationLevel[] = [];

  for (const target of input.targets) {
    const shares =
      input.targetCoverId[target.id] === input.emplacement.id;
    const los = hasLineOfSight(input.observer, target.position, walls);
    const inBoundary = allowed.has(target.id);

    if (shares) {
      targetVis.push(inBoundary ? "exact" : "approximate");
      continue;
    }

    if (input.emplacement.emplacement === "full_body" && !los) {
      targetVis.push(inBoundary ? "exact" : "approximate");
      continue;
    }

    targetVis.push(localizationFromSight(los, inBoundary));
  }

  return {
    coverId: input.emplacement.id,
    emplacement: input.emplacement.emplacement,
    enabled: true,
    distance: input.emplacement.distanceToEnter,
    targetVis,
  };
}

export function emplacementRowsFromSlice(
  slice: CoverEmplacementSlice,
  targets: readonly CharacterActor[],
  targetCoverId: Readonly<Record<string, string | null>>,
): CoverEmplacementTargetRow[] {
  return targets.map((target, i) => ({
    targetId: target.id,
    localization: slice.targetVis[i] ?? "approximate",
    sharesEmplacement: targetCoverId[target.id] === slice.coverId,
  }));
}

/** @deprecated Use CoverEmplacementSlice per emplacement. */
export type CoverConcealmentPacked = CoverEmplacementSlice;
