/** Wall-clock SLA for NPC decide() in browser / WASM worker. */
export const NPC_AI_WALL_MS = 5000;
export const NPC_AI_DEADLINE_MS = 4800;

/** Chance a single Expert decide() run weights lethal outcomes (otherwise default utility). */
export const EXPERT_LETHALITY_FOCUS_PROB = 0.4;

export type NpcDifficultyId =
  | "newstupid"
  | "novice"
  | "trained"
  | "expert"
  | "professional";

export const NPC_DIFFICULTY_IDS: readonly NpcDifficultyId[] = [
  "newstupid",
  "novice",
  "trained",
  "expert",
  "professional",
];

/** Bench UI labels (not i18n). */
export const NPC_DIFFICULTY_LABELS: Record<NpcDifficultyId, string> = {
  newstupid: "新手/愚钝",
  novice: "入门",
  trained: "训练有素",
  expert: "专家",
  professional: "职业",
};

/** Per-turn action shape before full combat state exists in the repo. */
export type NpcActionShape =
  | "move_xor_standard"
  | "dual_free"
  | "action_economy";

/** When eval favors downing / kill lines. */
export type LethalityFocus = "none" | "probabilistic" | "prioritized";

/** How far search projects the following turn. */
export type NextRoundPlanning = "none" | "coarse" | "expected";

export type NpcDifficultyProfile = {
  id: NpcDifficultyId;
  actionShape: NpcActionShape;
  /** Newstupid: one slot, move or standard, never both. */
  singleActionMoveXorStandard: boolean;
  considersCover: boolean;
  /** Trained+: penetration vs stacked cover thickness on the shot line. */
  considersCoverThickness: boolean;
  /** Trained+: 定位 shots may damage through cover when penetration is insufficient. */
  allowsLocatedShotThroughCover: boolean;
  /** Novice+: expected ammo penetration vs target armor in shot selection. */
  considersArmorPenetration: boolean;
  considersActionEconomy: boolean;
  /** Trained caps at 2; Expert/Professional use every remaining initiative round. */
  maxInitiativeRounds: 0 | 2 | "all";
  allowsInsertedActions: boolean;
  lethalityFocus: LethalityFocus;
  nextRoundPlanning: NextRoundPlanning;
  /**
   * Scales unified-action combo penalties inside AI planning (1 = rules-as-written).
   * Professional plans abuse routes with a lower effective malus.
   */
  unifiedActionPenaltyFactor: number;
};

export const NPC_DIFFICULTY_PROFILES: Record<NpcDifficultyId, NpcDifficultyProfile> = {
  newstupid: {
    id: "newstupid",
    actionShape: "move_xor_standard",
    singleActionMoveXorStandard: true,
    considersCover: false,
    considersCoverThickness: false,
    allowsLocatedShotThroughCover: false,
    considersArmorPenetration: false,
    considersActionEconomy: false,
    maxInitiativeRounds: 0,
    allowsInsertedActions: false,
    lethalityFocus: "none",
    nextRoundPlanning: "none",
    unifiedActionPenaltyFactor: 1,
  },
  novice: {
    id: "novice",
    actionShape: "dual_free",
    singleActionMoveXorStandard: false,
    considersCover: true,
    considersCoverThickness: false,
    allowsLocatedShotThroughCover: false,
    considersArmorPenetration: true,
    considersActionEconomy: false,
    maxInitiativeRounds: 0,
    allowsInsertedActions: false,
    lethalityFocus: "none",
    nextRoundPlanning: "none",
    unifiedActionPenaltyFactor: 1,
  },
  trained: {
    id: "trained",
    actionShape: "action_economy",
    singleActionMoveXorStandard: false,
    considersCover: true,
    considersCoverThickness: true,
    allowsLocatedShotThroughCover: true,
    considersArmorPenetration: true,
    considersActionEconomy: true,
    maxInitiativeRounds: 2,
    allowsInsertedActions: true,
    lethalityFocus: "none",
    nextRoundPlanning: "none",
    unifiedActionPenaltyFactor: 1,
  },
  expert: {
    id: "expert",
    actionShape: "action_economy",
    singleActionMoveXorStandard: false,
    considersCover: true,
    considersCoverThickness: true,
    allowsLocatedShotThroughCover: true,
    considersArmorPenetration: true,
    considersActionEconomy: true,
    maxInitiativeRounds: "all",
    allowsInsertedActions: true,
    lethalityFocus: "probabilistic",
    nextRoundPlanning: "coarse",
    unifiedActionPenaltyFactor: 1,
  },
  professional: {
    id: "professional",
    actionShape: "action_economy",
    singleActionMoveXorStandard: false,
    considersCover: true,
    considersCoverThickness: true,
    allowsLocatedShotThroughCover: true,
    considersArmorPenetration: true,
    considersActionEconomy: true,
    maxInitiativeRounds: "all",
    allowsInsertedActions: true,
    lethalityFocus: "prioritized",
    nextRoundPlanning: "expected",
    unifiedActionPenaltyFactor: 0.55,
  },
};

export function getNpcDifficultyProfile(id: NpcDifficultyId): NpcDifficultyProfile {
  return NPC_DIFFICULTY_PROFILES[id];
}

export function isExpertTierCore(profile: NpcDifficultyProfile): boolean {
  return (
    profile.actionShape === "action_economy" &&
    profile.considersCover &&
    profile.considersActionEconomy &&
    profile.maxInitiativeRounds === "all" &&
    profile.allowsInsertedActions
  );
}

/** Whether this decide() run should apply lethal-weighted utility. */
export function lethalityFocusActive(
  profile: NpcDifficultyProfile,
  random01: number,
): boolean {
  if (profile.lethalityFocus === "none") return false;
  if (profile.lethalityFocus === "prioritized") return true;
  return random01 < EXPERT_LETHALITY_FOCUS_PROB;
}

/** Effective malus when scoring unified-action combos in search. */
export function effectiveUnifiedActionPenalty(
  profile: NpcDifficultyProfile,
  rulesPenalty: number,
): number {
  return rulesPenalty * profile.unifiedActionPenaltyFactor;
}

/** When suppressive_fire is the top utility option, execute it with this probability. */
export const SUPPRESSIVE_FIRE_GATE: Record<NpcDifficultyId, number> = {
  newstupid: 0,
  novice: 0,
  trained: 0.1,
  expert: 0.3,
  professional: 1,
};

/** When delayed/conditional timing is optimal, use it with this probability (calibration TBD). */
export const DELAYED_CONDITIONAL_GATE: Record<NpcDifficultyId, number> = {
  newstupid: 0,
  novice: 0.05,
  trained: 0.15,
  expert: 0.3,
  professional: 0.5,
};

export function suppressiveFireGatePasses(
  profile: NpcDifficultyProfile,
  random01: number,
): boolean {
  const gate = SUPPRESSIVE_FIRE_GATE[profile.id];
  if (gate >= 1) return true;
  if (gate <= 0) return false;
  return random01 < gate;
}

export function delayedConditionalGatePasses(
  profile: NpcDifficultyProfile,
  random01: number,
): boolean {
  const gate = DELAYED_CONDITIONAL_GATE[profile.id];
  if (gate >= 1) return true;
  if (gate <= 0) return false;
  return random01 < gate;
}
