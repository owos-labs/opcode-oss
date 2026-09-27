import type { CombatLocalizationLevel } from "../combat-ai/cover-concealment-view.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";

/** Cross-round auto fire; FSM owns dice expectations and malus tiers. */
export type SustainedFireState = {
  active: boolean;
  /** Walk-your-fire malus tier cached for planning (0 = none). */
  walkFireMalus: number;
  /** Bumps when FSM updates sustained fire; recheck compares this. */
  token: number;
};

export type CombatTargetView = {
  id: string;
  position: Vec2;
  localization: CombatLocalizationLevel;
  armorByPart: Record<string, number>;
  coverId: string | null;
};

export type CombatEncounterConfig = {
  profileId: NpcDifficultyId;
  allowNpcSurrender: boolean;
  surrenderThreshold: number;
};

export type CombatWeaponView = {
  rangeM: number;
  rateOfFire: number;
  accuracy: number;
  /** At least semi-auto required for suppressive fire. */
  semiAutoOrBetter: boolean;
};

export type CombatAmmoView = {
  penetration: number;
  /** Expected damage dice count for utility (not rolling). */
  expectedDamageDice: number;
  roundsInMagazine: number;
};

/** Immutable decide() input; FSM materializes effective AR / SSP before build. */
export type CombatSnapshot = {
  snapshotVersion: number;
  barrierVersion: number;
  actorId: string;
  position: Vec2;
  mov: number;
  initiativeTotal: number;
  initiativeRemaining: number;
  metersMovedThisRound: number;
  coverId: string | null;
  weapon: CombatWeaponView;
  ammo: CombatAmmoView;
  sustainedFire: SustainedFireState;
  suppressionActive: boolean;
  targets: readonly CombatTargetView[];
  encounter: CombatEncounterConfig;
  /** Grenade / throwable slot for MVP (single item). */
  throwable?: {
    rangeM: number;
    expectedDamageDice: number;
  };
};

export function sustainedFireRecheckToken(state: SustainedFireState): number {
  return state.token;
}
