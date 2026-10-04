import type { CombatMapComplianceIssue } from "./combat-map-compliance.ts";

export type CombatMapComplianceTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function formatCombatMapComplianceIssue(
  issue: CombatMapComplianceIssue,
  t: CombatMapComplianceTranslate,
): string {
  if (issue.elementId) {
    return t(issue.messageKey, { id: issue.elementId });
  }
  return t(issue.messageKey);
}
