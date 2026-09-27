import type {
  CombatLocalizationLevel,
  CoverHeightBand,
} from "../combat-ai/cover-concealment-view.ts";
import { coverHeightHitDifficultyAdd } from "./cover-height.ts";

/** Fuzzy localization — no direct aimed fire (1.6). */
export function canImmediateDirectFire(level: CombatLocalizationLevel): boolean {
  return level === "full";
}

/** Only predicate supported in phase 2: fire when target becomes fully visible. */
export function canConditionalFireWhenTargetVisible(
  level: CombatLocalizationLevel,
): boolean {
  return level === "exact";
}

/** Hit difficulty adder from localization + cover height (1.7 / 1.6 tables). */
export function localizationHitDifficultyAdd(level: CombatLocalizationLevel): number {
  if (level === "approximate") return 10;
  if (level === "exact") return 5;
  return 0;
}

export function targetCoverHitDifficultyAdd(coverBand: CoverHeightBand | undefined): number {
  if (!coverBand || coverBand === "none") return 0;
  return coverHeightHitDifficultyAdd(coverBand);
}
