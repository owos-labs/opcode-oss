import type { ActionIntent } from "../combat-ai/search.ts";

/** Phase-2 only conditional: shoot when target reaches full localization. */
export const CONDITIONAL_PREDICATE_TARGET_VISIBLE = "target_full_localization" as const;

export type ConditionalFirePredicateId = typeof CONDITIONAL_PREDICATE_TARGET_VISIBLE;

export type ActionIntentWithPredicate = ActionIntent & {
  conditionalPredicate?: ConditionalFirePredicateId;
};

export function isSeeTargetThenShootIntent(
  intent: ActionIntentWithPredicate,
): boolean {
  return (
    intent.timing === "conditional" &&
    intent.conditionalPredicate === CONDITIONAL_PREDICATE_TARGET_VISIBLE
  );
}
