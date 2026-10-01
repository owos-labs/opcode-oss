/** Wall-clock SLA for NPC decide() in browser / WASM worker. */
export const NPC_AI_WALL_MS = 5000;
export const NPC_AI_DEADLINE_MS = 4800;

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
  newstupid: "简单",
  novice: "普通",
  trained: "困难",
  expert: "专家",
  professional: "职业",
};

export function formatUnitDifficultyName(label: string, difficulty: NpcDifficultyId): string {
  return `${label}（${NPC_DIFFICULTY_LABELS[difficulty]}）`;
}

/** Per-turn action shape before full combat state exists in the repo. */
export type NpcActionShape =
  | "move_xor_standard"
  | "dual_free"
  | "action_economy";

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
