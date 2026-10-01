import type { OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import type { OpcodeVitalsState } from "../character-sheets/opcode-health-vitals.ts";
import type { CombatLocalizationLevel } from "../combat-ai/cover-concealment-view.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import type { NpcDifficultyId } from "../combat-ai/difficulty.ts";
import type { EncounterMission, LocalizationStore } from "./localization.ts";
import type { EncounterNav } from "./patrol.ts";

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
  healthMode?: "simple" | "normal";
  maxHp?: number;
  parts?: Partial<
    Record<
      OpcodeHealthPart,
      { current: number; max: number; destroyed?: boolean; severed?: boolean }
    >
  >;
  vitals?: OpcodeVitalsState;
  saveStats?: { wil: number; bod: number; fortitude: number };
  /** Only populate from information this difficulty is allowed to know. */
  attackBonus?: number;
  reflexSaveBonus?: number;
  damagePerHit?: number;
  weaponRangeM?: number;
};

export type CombatEncounterConfig = {
  profileId: NpcDifficultyId;
  allowNpcSurrender: boolean;
  surrenderThreshold: number;
  mission?: EncounterMission;
};

export type CombatFireModeId = "semi" | "auto" | "burst";

export type CombatWeaponView = {
  id?: string;
  rangeM: number;
  rateOfFire: number;
  accuracy: number;
  /** At least semi-auto required for suppressive fire. */
  semiAutoOrBetter: boolean;
  availableFireModes?: readonly CombatFireModeId[];
  defaultFireMode?: CombatFireModeId;
  /** Planning flag: weapon is expected to pen cover on the shot line. */
  canPenCover?: boolean;
  /** Professional burst: hit pool is large enough. */
  burstPoolOk?: boolean;
};

export type CombatAmmoView = {
  penetration: number;
  /** Expected damage dice count for utility (not rolling). */
  expectedDamageDice: number;
  /** Rolled expr when present, e.g. `3d6`. */
  damageDiceExpr?: string;
  roundsInMagazine: number;
  /** Explosive loads split damage evenly across all body parts. */
  explosive?: boolean;
};

/** Immutable decide() input; FSM materializes effective AR / SSP before build. */
export type CombatSnapshot = {
  snapshotVersion: number;
  barrierVersion: number;
  actorId: string;
  position: Vec2;
  mov: number;
  /** SENS × 10m; used when predicting sight gained by a move. */
  visionRangeM?: number;
  /** Attribute + skill + specialization; action penalties are applied by the planner. */
  attackBonus?: number;
  armorByPart?: Record<string, number>;
  reflexSaveBonus?: number;
  healthMode?: "simple" | "normal";
  hitPoints?: number;
  maxHp?: number;
  parts?: CombatTargetView["parts"];
  vitals?: OpcodeVitalsState;
  saveStats?: CombatTargetView["saveStats"];
  declaredStandardActions?: number;
  /** Planned standard_fire count this round (semi malus uses this, not reload/suppress). */
  declaredStandardFires?: number;
  standardFiresThisRound?: number;
  initiativeTotal: number;
  initiativeRemaining: number;
  metersMovedThisRound: number;
  /** Rounds already fired with this weapon this combat round (ROF/20 cap). */
  weaponRoundsThisRound?: number;
  /** Standard actions already resolved this combat round (walk-your-fire index). */
  standardActionsThisRound?: number;
  coverId: string | null;
  weapon: CombatWeaponView;
  ammo: CombatAmmoView;
  sustainedFire: SustainedFireState;
  suppressionActive: boolean;
  targets: readonly CombatTargetView[];
  encounter: CombatEncounterConfig;
  /** Observer faction for intel reads (bench team id). */
  factionId?: string;
  /** Authority for loc / intel fields; AI must not peek the enemy sheet. */
  intel?: LocalizationStore;
  /** Rooms + unweighted patrol graph; rebuilt at encounter start / patrol end. */
  nav?: EncounterNav;
  /** Grenade / throwable slot for MVP (single item). */
  throwable?: {
    rangeM: number;
    expectedDamageDice: number;
  };
  /** Remaining LUK points (professional rerolls). */
  lukLeft?: number;
  /** Living allied count on the map, including self. Used for trained- headcount. */
  allyCount?: number;
  /** Visible moving path on a located hostile (conditional intercept, not extra round). */
  locatedPathAmbush?: boolean;
  /** Keep a disengagement across rounds until the exchange or headcount improves. */
  disengaging?: boolean;
  expectedToBeKilled?: boolean;
  keyKill?: boolean;
  throwBackAllowed?: boolean;
};

export function sustainedFireRecheckToken(state: SustainedFireState): number {
  return state.token;
}
